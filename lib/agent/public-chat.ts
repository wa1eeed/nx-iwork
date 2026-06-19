// Public visitor chat: a website visitor talks to the company's customer-service
// agent through the embedded widget. Reuses the shared agent loop, but logs to
// PublicConversation/PublicMessage (not the dashboard ChatMessage) and is scoped
// to the agent the owner designated for the widget.

import { db } from '@/lib/db';
import { getProviderForCompany } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { checkTokenBudget, chargeTokens } from '@/lib/billing/tokens';
import { buildSystemPrompt } from './prompt';
import { loadAgentWithContext, runToolLoop } from './core';
import { recallMemoryBlock } from './memory';
import { getToolsForCompany } from './tools';

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

export async function runPublicAgentChat(input: PublicChatInput): Promise<PublicChatResult> {
  const { companyId, agentId, visitorId, message, meta } = input;

  const agent = await loadAgentWithContext(agentId, companyId);
  if (!agent) return { ok: false, reason: 'unavailable' };

  const providerResult = await getProviderForCompany(companyId);
  if (!providerResult.ok) return { ok: false, reason: 'unavailable' };

  const budget = await checkTokenBudget(companyId);
  if (!budget.ok) return { ok: false, reason: budget.reason };

  // One ongoing conversation per visitor per company.
  const conversation =
    (await db.publicConversation.findFirst({
      where: { companyId, visitorId, ended: false },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true },
    })) ??
    (await db.publicConversation.create({
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
    }));

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

  let reply: string;
  let tokensUsed: number;
  try {
    ({ reply, tokensUsed } = await runToolLoop({
      provider: providerResult.provider,
      system,
      messages,
      tier: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      tools: getToolsForCompany(agent.company),
      ctx: { companyId, agentId },
    }));
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
  await chargeTokens(companyId, tokensUsed);

  return { ok: true, reply };
}
