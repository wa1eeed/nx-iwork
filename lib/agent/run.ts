// Agent chat turn. Loads the agent's working-memory history, runs the shared
// tool-loop, and persists the human message + final reply. The "how an agent
// thinks" logic lives in lib/agent/core.ts (shared with task execution).

import { db } from '@/lib/db';
import { getProviderForModel } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { checkTokenBudget, chargeTokens } from '@/lib/billing/tokens';
import { checkAgentBudget, chargeAgentTokens } from '@/lib/billing/agent-tokens';
import { buildSystemPrompt } from './prompt';
import { loadAgentWithContext, runToolLoop, runToolLoopStream, agentModelId, skillPromptBlock, skillToolIds } from './core';
import { getMcpToolsForCompany } from '@/lib/mcp/registry';
import { recallMemoryBlock } from './memory';
import { getToolsForAgent } from './tools';

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
  input: RunAgentChatInput,
  opts?: { onDelta?: (delta: string) => void }
): Promise<RunAgentResult> {
  const { agentId, companyId, userMessage, userId } = input;

  const agent = await loadAgentWithContext(agentId, companyId);
  if (!agent) return { ok: false, reason: 'agent_not_found' };

  // A registry model pinned to this agent chooses its own vendor; otherwise the
  // company's default provider (managed Vertex / BYOK) runs the tier.
  const providerResult = await getProviderForModel(companyId, agent.aiModel);
  if (!providerResult.ok) return { ok: false, reason: providerResult.reason };

  // Managed mode: refuse before spending if the token bank is empty.
  const budget = await checkTokenBudget(companyId);
  if (!budget.ok) return { ok: false, reason: budget.reason };
  // …and if this agent has hit its monthly per-agent ceiling.
  const agentBudget = await checkAgentBudget(agentId);
  if (!agentBudget.ok) return { ok: false, reason: 'billing_limit' };

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
    guardrails: agent.company, // owner governance applies to owner-directed work too
    audience: 'internal', // dashboard chat: the owner is talking, not a customer
  });

  // Inject relevant long-term memories for this turn (empty when none/disabled).
  const memoryBlock = await recallMemoryBlock(agentId, companyId, userMessage);
  if (memoryBlock) system += `\n\n${memoryBlock}`;

  // Inject the instructions from any skills attached to this agent.
  const skillBlock = skillPromptBlock(agent.skills);
  if (skillBlock) system += `\n\n${skillBlock}`;

  // Dashboard chat: the interlocutor is the OWNER/admin, so the agent should be
  // able to READ the whole operation and run schedule ops to answer business
  // questions and act on instructions — even if its customer-facing scope is
  // narrower. These are the internal-only tools we never expose on the public
  // widget (list_bookings/set_booking_staff carry PII / are owner actions).
  // Module gates in getToolsForAgent still apply; empty perms already mean "all".
  let perms = agent.permissions;
  if (perms.length > 0) {
    const internal = ['find_customer', 'search_catalog', 'search_faq', 'create_task', 'update_task_status', 'save_memory', 'create_output', 'delegate_to_agent'];
    if (agent.company.hasBookings) {
      internal.push('list_bookings', 'list_open_slots', 'check_availability', 'create_booking', 'update_booking', 'set_booking_staff');
    }
    // Skills also expand a scoped agent's allow-list with the tools they grant.
    perms = Array.from(new Set([...perms, ...internal, ...skillToolIds(agent.skills)]));
  }

  let reply: string;
  let tokensUsed: number;
  try {
    const baseTools = getToolsForAgent({ ...agent.company, hasObjects: agent.company._count.objectTypes > 0 }, perms);
    // Agents with MCP access (empty allow-list = all tools, or an explicit
    // `use_mcp` grant) also receive the company's registered third-party MCP tools.
    const wantsMcp = agent.permissions.length === 0 || agent.permissions.includes('use_mcp');
    const loopArgs = {
      provider: providerResult.provider,
      system,
      messages,
      tier: agent.model,
      model: agentModelId(agent.aiModel, providerResult.provider.id),
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      tools: wantsMcp ? [...baseTools, ...(await getMcpToolsForCompany(companyId))] : baseTools,
      ctx: { companyId, agentId },
    };
    ({ reply, tokensUsed } = opts?.onDelta
      ? await runToolLoopStream(loopArgs, opts.onDelta)
      : await runToolLoop(loopArgs));
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
  const remaining = await chargeTokens(companyId, tokensUsed);
  await chargeAgentTokens(agentId, tokensUsed);
  console.log(`[token-guard] dashboard-chat | tenant=${companyId} | used=${tokensUsed} | remaining=${remaining ?? 'BYOK'}`);

  return { ok: true, reply, tokensUsed };
}
