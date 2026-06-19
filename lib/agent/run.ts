// Agent chat turn. Loads the agent's working-memory history, runs the shared
// tool-loop, and persists the human message + final reply. The "how an agent
// thinks" logic lives in lib/agent/core.ts (shared with task execution).

import { db } from '@/lib/db';
import { getProviderForCompany } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { checkTokenBudget, chargeTokens } from '@/lib/billing/tokens';
import { buildSystemPrompt } from './prompt';
import { loadAgentWithContext, runToolLoop } from './core';
import { recallMemoryBlock } from './memory';
import { getToolsForCompany } from './tools';

// How many recent messages form the agent's "working memory". Kept small to
// bound token cost; older context will come from episodic/semantic memory.
const WORKING_MEMORY_LIMIT = 20;

export type RunAgentResult =
  | { ok: true; reply: string; tokensUsed: number }
  | {
      ok: false;
      reason:
        | 'agent_not_found'
        | 'no_key'
        | 'no_settings'
        | 'decrypt_failed'
        | 'vertex_not_configured'
        | 'billing_limit'
        | 'provider_error';
      message?: string;
    };

export interface RunAgentChatInput {
  agentId: string;
  companyId: string;
  /** The new message from the human. */
  userMessage: string;
  /** Author of the message (business owner/member), if any. */
  userId?: string;
}

export async function runAgentChat(
  input: RunAgentChatInput
): Promise<RunAgentResult> {
  const { agentId, companyId, userMessage, userId } = input;

  const agent = await loadAgentWithContext(agentId, companyId);
  if (!agent) return { ok: false, reason: 'agent_not_found' };

  const providerResult = await getProviderForCompany(companyId);
  if (!providerResult.ok) return { ok: false, reason: providerResult.reason };

  // Managed mode: refuse before spending if the token bank is empty.
  const budget = await checkTokenBudget(companyId);
  if (!budget.ok) return { ok: false, reason: budget.reason };

  // Working memory: last N messages for this agent, oldest-first for the model.
  const history = await db.chatMessage.findMany({
    where: { agentId, companyId },
    orderBy: { createdAt: 'desc' },
    take: WORKING_MEMORY_LIMIT,
    select: { role: true, content: true },
  });

  const messages: AiMessage[] = history
    .reverse()
    .filter((m) => m.role === 'USER' || m.role === 'AGENT')
    .map((m) =>
      m.role === 'AGENT'
        ? { role: 'assistant', content: m.content }
        : { role: 'user', content: m.content }
    );
  messages.push({ role: 'user', content: userMessage });

  let system = buildSystemPrompt({
    agent,
    company: agent.company,
    dna: agent.company.companyDNA,
    settings: agent.company.settings,
  });

  // Inject relevant long-term memories for this turn (empty when none/disabled).
  const memoryBlock = await recallMemoryBlock(agentId, companyId, userMessage);
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
    console.error('Agent provider error', { agentId, companyId, err });
    return {
      ok: false,
      reason: 'provider_error',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }

  // Persist the turn (only the human message + final reply land in working
  // memory; intermediate tool chatter stays out of history) and update stats.
  await db.$transaction([
    db.chatMessage.create({
      data: { companyId, agentId, role: 'USER', content: userMessage, userId },
    }),
    db.chatMessage.create({
      data: {
        companyId,
        agentId,
        role: 'AGENT',
        content: reply,
        tokensUsed,
        model: providerResult.provider.id,
      },
    }),
    db.agent.update({
      where: { id: agentId },
      data: { totalTokensUsed: { increment: tokensUsed } },
    }),
  ]);

  // Managed mode: bill the token bank for this turn (no-op in BYOK).
  await chargeTokens(companyId, tokensUsed);

  return { ok: true, reply, tokensUsed };
}
