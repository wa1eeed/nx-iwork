// Public visitor chat: a website visitor talks to the company's customer-service
// agent through the embedded widget. Reuses the shared agent loop, but logs to
// PublicConversation/PublicMessage (not the dashboard ChatMessage) and is scoped
// to the agent the owner designated for the widget.

import { db } from '@/lib/db';
import { getProviderForCompany, providerForAgentModel } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { checkTokenBudget, chargeTokens } from '@/lib/billing/tokens';
import { checkAgentBudget, chargeAgentTokens } from '@/lib/billing/agent-tokens';
import { buildSystemPrompt } from './prompt';
import { loadAgentWithContext, runToolLoop, runToolLoopStream, agentModelId, skillPromptBlock, skillToolIds } from './core';
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
  // of DB round-trips (each is real latency on a remote Postgres). Memory recall
  // (a network embedding round-trip when the agent has memories) rides along here
  // too so it never adds serial latency before the model starts — this is a big
  // part of the "slow to reply on first contact" the owner reported.
  const [agent, providerResult, budget, agentBudget, conversation, memoryBlock] = await Promise.all([
    loadAgentWithContext(agentId, companyId),
    getProviderForCompany(companyId),
    checkTokenBudget(companyId),
    checkAgentBudget(agentId),
    getOrCreateConversation(input),
    recallMemoryBlock(agentId, companyId, message),
  ]);

  if (!agent) return { ok: false, reason: 'unavailable' };
  // Hard scope: only customer-facing archetypes (front desk / sales / care) may
  // serve the public widget. An internal archetype (marketing/finance/ops) must
  // never answer a customer, even if misconfigured as the widget agent.
  if (agent.surface === 'INTERNAL') return { ok: false, reason: 'unavailable' };
  // A registry model pinned to this agent chooses its own vendor; otherwise the
  // company default provider fetched above. Sync override — no extra round-trip.
  const effective = providerForAgentModel(providerResult, agent.aiModel);
  if (!effective.ok) return { ok: false, reason: 'unavailable' };
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
  if (memoryBlock) system += `\n\n${memoryBlock}`;
  const skillBlock = skillPromptBlock(agent.skills);
  if (skillBlock) system += `\n\n${skillBlock}`;

  // The public-facing agent should always be able to check availability + book
  // when the business is booking-enabled — it's the core customer expectation.
  // Empty permissions already mean "all module tools", so only augment a scoped
  // agent (non-empty list) to avoid accidentally narrowing it.
  let perms = agent.permissions;
  if (perms.length > 0) {
    const extra = skillToolIds(agent.skills);
    if (agent.company.hasBookings) extra.push('check_availability', 'list_open_slots', 'create_booking', 'create_lead');
    perms = Array.from(new Set([...perms, ...extra]));
  }

  // Hard default-DENY on the customer surface: no matter how the agent is
  // configured, a website visitor may ONLY search the catalog/FAQ, check
  // availability, book, and leave their details. This stops a visitor from
  // prompt-injecting into PII reads (find_customer / list_bookings enumerate the
  // CRM), modifying other people's bookings, or triggering internal tools.
  const PUBLIC_ALLOWLIST = new Set([
    'search_catalog',
    'search_faq',
    'check_availability',
    'list_open_slots',
    'create_booking',
    'create_lead',
    // Read-only access to the company's custom data (e.g. a real-estate office's
    // property listings). Still gated by the agent's own permissions + the
    // hasObjects module flag, so the owner grants it per agent intentionally.
    'list_object_types',
    'query_records',
  ]);
  const tools = getToolsForAgent(
    { ...agent.company, hasObjects: agent.company._count.objectTypes > 0 },
    perms
  ).filter((t) => PUBLIC_ALLOWLIST.has(t.name));

  const loopArgs = {
    provider: effective.provider,
    system,
    messages,
    tier: agent.model,
    model: agentModelId(agent.aiModel, effective.provider.id),
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    tools,
    // Light reasoning budget so the model RELIABLY decides to call its tools
    // (search_catalog for prices, query_records for listings). At 0 the flash
    // model answered reflexively — sometimes from memory — which produced flaky
    // wrong prices and false "not available". Accuracy for a customer-facing
    // pricing/booking agent outweighs the ~1s it adds to the first token.
    thinkingBudget: 1024,
    // Customer widget: stream ONLY the final reply, never the model's inter-round
    // "let me check availability…" narration — so a multi-tool booking reads as
    // one clean confirmation instead of a play-by-play. (Dashboard chat keeps
    // token-by-token streaming since the owner benefits from seeing tool activity.)
    streamFinalOnly: true,
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
