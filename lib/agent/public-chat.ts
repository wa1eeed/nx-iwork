// Public visitor chat: a website visitor talks to the company's customer-service
// agent through the embedded widget. Reuses the shared agent loop, but logs to
// PublicConversation/PublicMessage (not the dashboard ChatMessage) and is scoped
// to the agent the owner designated for the widget.

import { db } from '@/lib/db';
import { getProviderForCompany } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { checkTokenBudget, chargeTokens } from '@/lib/billing/tokens';
import { checkAgentBudget, chargeAgentTokens } from '@/lib/billing/agent-tokens';
import { buildSystemPrompt } from './prompt';
import { loadAgentWithContext, runToolLoop, runToolLoopStream } from './core';
import { recallMemoryBlock } from './memory';
import { getToolsForAgent } from './tools';

const WORKING_MEMORY_LIMIT = 16;

export type PublicChatResult =
  | { ok: true; reply: string }
  | { ok: false; reason: 'unavailable' | 'billing_limit' | 'provider_error' };

export interface PublicChatInput {
  companyId: string;
  agentId: string;
  visitorId: string;
  message: string;
  meta?: { pageUrl?: string; referrer?: string; userAgent?: string; ip?: string };
}

export interface PublicChatOptions {
  /** When provided, the reply text is streamed token-by-token as it generates. */
  onDelta?: (delta: string) => void;
}

// One ongoing conversation per visitor per company (find-or-create).
async function getOrCreateConversation(input: PublicChatInput): Promise<{ id: string }> {
  const { companyId, agentId, visitorId, meta } = input;
  const existing = await db.publicConversation.findFirst({
    where: { companyId, visitorId, ended: false },
    orderBy: { lastMessageAt: 'desc' },
    select: { id: true },
  });
  if (existing) return existing;
  return db.publicConversation.create({
    data: {
      companyId,
      agentId,
      visitorId,
      pageUrl: meta?.pageUrl,
      referrer: meta?.referrer,
      userAgent: meta?.userAgent,
      ipAddress: meta?.ip,
    },
    select: { id: true },
  });
}

export async function runPublicAgentChat(
  input: PublicChatInput,
  opts: PublicChatOptions = {}
): Promise<PublicChatResult> {
  const { companyId, agentId, visitorId, message, meta } = input;

  // Pre-flight: run the independent reads concurrently instead of a serial chain
  // of DB round-trips (each is real latency on a remote Postgres).
  const [agent, providerResult, budget, agentBudget, conversation] = await Promise.all([
    loadAgentWithContext(agentId, companyId),
    getProviderForCompany(companyId),
    checkTokenBudget(companyId),
    checkAgentBudget(agentId),
    getOrCreateConversation(input),
  ]);

  if (!agent) return { ok: false, reason: 'unavailable' };
  if (!providerResult.ok) return { ok: false, reason: 'unavailable' };
  if (!budget.ok) return { ok: false, reason: budget.reason };
  if (!agentBudget.ok) return { ok: false, reason: 'billing_limit' };

  // Working memory from this conversation's history.
  const history = await db.publicMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    take: WORKING_MEMORY_LIMIT,
    select: { role: true, content: true },
  });
  const messages: AiMessage[] = history
    .reverse()
    .filter((m) => m.role === 'USER' || m.role === 'AGENT')
    .map((m) => (m.role === 'AGENT' ? { role: 'assistant', content: m.content } : { role: 'user', content: m.content }));
  messages.push({ role: 'user', content: message });

  let system = buildSystemPrompt({
    agent,
    company: agent.company,
    dna: agent.company.companyDNA,
    settings: agent.company.settings,
  });
  const memoryBlock = await recallMemoryBlock(agentId, companyId, message);
  if (memoryBlock) system += `\n\n${memoryBlock}`;

  // The public-facing agent should always be able to check availability + book
  // when the business is booking-enabled — it's the core customer expectation.
  // Empty permissions already mean "all module tools", so only augment a scoped
  // agent (non-empty list) to avoid accidentally narrowing it.
  let perms = agent.permissions;
  if (perms.length > 0 && agent.company.hasBookings) {
    perms = Array.from(
      new Set([
        ...perms,
        'check_availability',
        'list_open_slots',
        'create_booking',
        'find_customer',
        'create_lead',
      ])
    );
  }

  const loopArgs = {
    provider: providerResult.provider,
    system,
    messages,
    tier: agent.model,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    tools: getToolsForAgent(agent.company, perms),
    ctx: { companyId, agentId },
  };

  let reply: string;
  let tokensUsed: number;
  try {
    ({ reply, tokensUsed } = opts.onDelta
      ? await runToolLoopStream(loopArgs, opts.onDelta)
      : await runToolLoop(loopArgs));
  } catch (err) {
    console.error('Public chat provider error', { companyId, agentId, err });
    return { ok: false, reason: 'provider_error' };
  }

  await db.$transaction([
    db.publicMessage.create({ data: { conversationId: conversation.id, role: 'USER', content: message } }),
    db.publicMessage.create({
      data: { conversationId: conversation.id, role: 'AGENT', content: reply, tokensUsed },
    }),
    db.publicConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
    db.agent.update({ where: { id: agentId }, data: { totalTokensUsed: { increment: tokensUsed } } }),
  ]);
  const remaining = await chargeTokens(companyId, tokensUsed);
  await chargeAgentTokens(agentId, tokensUsed);
  console.log(`[token-guard] public-chat | tenant=${companyId} | used=${tokensUsed} | remaining=${remaining ?? 'BYOK'}`);

  // `meta` is captured on conversation creation; referenced here to keep the
  // param used even when the conversation already existed.
  void meta;
  void visitorId;

  return { ok: true, reply };
}
