// Agent Studio sandbox: run one message through an agent EXACTLY like the
// dashboard path (same provider, model, prompt, skills, tools) but WITHOUT
// persisting to chat history — and return the internals (which model/provider
// answered, tokens, and the tool calls it made) so the owner can test + tune an
// agent before pointing it at customers. Tokens are still charged (real inference).

import { getProviderForModel } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { checkTokenBudget, chargeTokens } from '@/lib/billing/tokens';
import { checkAgentBudget, chargeAgentTokens } from '@/lib/billing/agent-tokens';
import { buildSystemPrompt } from './prompt';
import { loadAgentWithContext, runToolLoop, agentModelId, skillPromptBlock, skillToolIds } from './core';
import { recallMemoryBlock } from './memory';
import { getToolsForAgent } from './tools';
import { getMcpToolsForCompany } from '@/lib/mcp/registry';

export interface SandboxTrace {
  name: string;
  ok: boolean;
  args: Record<string, unknown>;
  result: string;
}

export type SandboxResult =
  | {
      ok: true;
      reply: string;
      provider: string;
      model: string | null;
      tokensUsed: number;
      tools: SandboxTrace[];
      availableCount: number;
    }
  | { ok: false; reason: string };

export async function runAgentSandbox(
  agentId: string,
  companyId: string,
  message: string
): Promise<SandboxResult> {
  const agent = await loadAgentWithContext(agentId, companyId);
  if (!agent) return { ok: false, reason: 'agent_not_found' };

  const providerResult = await getProviderForModel(companyId, agent.aiModel);
  if (!providerResult.ok) return { ok: false, reason: providerResult.reason };

  const budget = await checkTokenBudget(companyId);
  if (!budget.ok) return { ok: false, reason: budget.reason };
  const agentBudget = await checkAgentBudget(agentId);
  if (!agentBudget.ok) return { ok: false, reason: 'billing_limit' };

  let system = buildSystemPrompt({
    agent,
    company: agent.company,
    dna: agent.company.companyDNA,
    settings: agent.company.settings,
    guardrails: agent.company,
    audience: 'internal',
  });
  const memoryBlock = await recallMemoryBlock(agentId, companyId, message);
  if (memoryBlock) system += `\n\n${memoryBlock}`;
  const skillBlock = skillPromptBlock(agent.skills);
  if (skillBlock) system += `\n\n${skillBlock}`;

  // Same allow-list expansion as the dashboard (internal) path.
  let perms = agent.permissions;
  if (perms.length > 0) {
    const internal = ['find_customer', 'search_catalog', 'search_faq', 'create_task', 'update_task_status', 'save_memory', 'create_output', 'delegate_to_agent'];
    if (agent.company.hasBookings) internal.push('list_bookings', 'list_open_slots', 'check_availability', 'create_booking', 'update_booking', 'set_booking_staff');
    perms = Array.from(new Set([...perms, ...internal, ...skillToolIds(agent.skills)]));
  }
  const baseTools = getToolsForAgent({ ...agent.company, hasObjects: agent.company._count.objectTypes > 0 }, perms);
  const wantsMcp = agent.permissions.length === 0 || agent.permissions.includes('use_mcp');
  const tools = wantsMcp ? [...baseTools, ...(await getMcpToolsForCompany(companyId))] : baseTools;

  const trace: SandboxTrace[] = [];
  const messages: AiMessage[] = [{ role: 'user', content: message }];
  const activeModel = agentModelId(agent.aiModel, providerResult.provider.id) ?? null;

  let reply: string;
  let tokensUsed: number;
  try {
    ({ reply, tokensUsed } = await runToolLoop({
      provider: providerResult.provider,
      system,
      messages,
      tier: agent.model,
      model: activeModel ?? undefined,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      tools,
      ctx: { companyId, agentId },
      onToolResult: (t) => {
        let ok = true;
        try {
          const parsed = JSON.parse(t.result) as { ok?: boolean };
          ok = parsed.ok !== false;
        } catch {
          /* non-JSON result — treat as ok */
        }
        trace.push({ name: t.name, ok, args: t.args, result: t.result.slice(0, 1200) });
      },
    }));
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'provider_error' };
  }

  // Meter real inference, but never persist a sandbox turn to the agent's history.
  await chargeTokens(companyId, tokensUsed);
  await chargeAgentTokens(agentId, tokensUsed);

  return {
    ok: true,
    reply,
    provider: providerResult.provider.id,
    model: activeModel,
    tokensUsed,
    tools: trace,
    availableCount: tools.length,
  };
}
