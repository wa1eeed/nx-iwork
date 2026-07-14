// Shared agent-loop core, used by both chat (lib/agent/run.ts) and task
// execution (lib/agent/task.ts). Keeping the loading + tool-loop here means the
// "how an agent thinks" logic lives in one place; callers only differ in how
// they source the prompt and persist the outcome.

import { db } from '@/lib/db';
import type { AiMessage, AiProvider, AiTool } from '@/lib/ai';
import { executeTool, type ToolContext } from './tools';

// Safety cap on tool round-trips per turn — a confused model can't loop forever.
export const MAX_TOOL_ROUNDS = 5;

// Pulls the agent plus the company context the system prompt needs. findFirst
// with companyId enforces tenant isolation.
export function loadAgentWithContext(agentId: string, companyId: string) {
  return db.agent.findFirst({
    where: { id: agentId, companyId },
    include: {
      company: {
        select: {
          name: true,
          nameEn: true,
          brandVoice: true,
          industry: true,
          hasEcommerce: true,
          hasServices: true,
          hasBookings: true,
          // Guardrails — injected into the agent's system prompt so governance
          // (approval-required, spend cap, message review) is actually enforced.
          requireApprovalForSensitive: true,
          requireMessageReview: true,
          spendApprovalCapEnabled: true,
          spendApprovalCapSar: true,
          companyDNA: {
            select: { aboutUs: true, policies: true, tone: true, targetAudience: true },
          },
          settings: { select: { primaryLanguage: true, timezone: true } },
          // Drives the Business Objects tool gate: agents only get the generic
          // record tools when the owner has actually defined a data type.
          _count: { select: { objectTypes: true } },
        },
      },
      // The concrete model the owner picked (registry). Null → tier fallback.
      aiModel: { select: { modelId: true, provider: true, enabled: true } },
      // Attached skills: their instructions are injected into the system prompt
      // and their tools are granted to the agent.
      skills: { select: { skill: { select: { promptTemplate: true, tools: true } } } },
    },
  });
}

// The instructions block for an agent's attached skills (empty when none).
export function skillPromptBlock(skills: { skill: { promptTemplate: string | null } }[]): string {
  const parts = skills
    .map((s) => s.skill.promptTemplate?.trim())
    .filter((p): p is string => Boolean(p));
  if (parts.length === 0) return '';
  return `## Your skills\nApply these when relevant:\n${parts.map((p) => `- ${p}`).join('\n')}`;
}

// The union of tool ids granted by an agent's attached skills.
export function skillToolIds(skills: { skill: { tools: string[] } }[]): string[] {
  return Array.from(new Set(skills.flatMap((s) => s.skill.tools ?? [])));
}

// Resolve the concrete model id to send the provider: the agent's registry model
// when it's enabled AND belongs to the active provider, otherwise undefined so
// the provider maps the capability tier to its own default id (backward compat).
export function agentModelId(
  aiModel: { modelId: string; provider: string; enabled: boolean } | null | undefined,
  activeProvider: string,
): string | undefined {
  return aiModel && aiModel.enabled && aiModel.provider === activeProvider ? aiModel.modelId : undefined;
}

export interface ToolLoopArgs {
  provider: AiProvider;
  system: string;
  messages: AiMessage[]; // mutated in place with tool turns
  tier: 'HAIKU' | 'SONNET' | 'OPUS';
  /** Concrete registry model id; falls back to the tier map when undefined. */
  model?: string;
  temperature: number;
  maxTokens: number;
  /** The tools to offer — already filtered to the company's enabled modules. */
  tools: AiTool[];
  ctx: ToolContext;
  /** Optional trace hook: called after each tool runs (used by the sandbox). */
  onToolResult?: (t: { name: string; args: Record<string, unknown>; result: string }) => void;
}

export interface ToolLoopResult {
  reply: string;
  tokensUsed: number;
}

// Runs the provider in a tool-use loop until it produces a final answer (or the
// round cap is hit). Throws on provider error; callers map that to their own
// failure shape.
export async function runToolLoop(args: ToolLoopArgs): Promise<ToolLoopResult> {
  const { provider, system, messages, tier, model, temperature, maxTokens, tools, ctx, onToolResult } = args;
  let reply = '';
  let tokensUsed = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const completion = await provider.complete({
      system,
      messages,
      tier,
      model,
      temperature,
      maxTokens,
      tools,
    });
    tokensUsed += completion.usage.inputTokens + completion.usage.outputTokens;

    if (!completion.needsTools || completion.toolCalls.length === 0) {
      reply = completion.text.trim();
      break;
    }

    messages.push({
      role: 'assistant',
      content: completion.text,
      toolCalls: completion.toolCalls,
    });
    for (const call of completion.toolCalls) {
      const result = await executeTool(call.name, call.args, ctx);
      onToolResult?.({ name: call.name, args: call.args, result });
      messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result });
    }

    if (round === MAX_TOOL_ROUNDS) {
      reply =
        completion.text.trim() ||
        'تعذّر إكمال الطلب بالكامل الآن. حوّلني لزميل بشري إن احتجت.';
    }
  }

  return { reply, tokensUsed };
}

// Streaming variant: identical tool loop, but the final answer's text is emitted
// to `onDelta` token-by-token as the provider generates it. Falls back to the
// non-streaming loop for providers without completeStream.
export async function runToolLoopStream(
  args: ToolLoopArgs,
  onDelta: (delta: string) => void
): Promise<ToolLoopResult> {
  const { provider, system, messages, tier, model, temperature, maxTokens, tools, ctx } = args;
  if (!provider.completeStream) {
    const r = await runToolLoop(args);
    onDelta(r.reply);
    return r;
  }

  let reply = '';
  let tokensUsed = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const gen = provider.completeStream({ system, messages, tier, model, temperature, maxTokens, tools });
    let roundText = '';
    let next = await gen.next();
    while (!next.done) {
      roundText += next.value;
      onDelta(next.value);
      next = await gen.next();
    }
    const completion = next.value;
    tokensUsed += completion.usage.inputTokens + completion.usage.outputTokens;

    if (!completion.needsTools || completion.toolCalls.length === 0) {
      reply = (completion.text || roundText).trim();
      break;
    }

    messages.push({
      role: 'assistant',
      content: completion.text,
      toolCalls: completion.toolCalls,
    });
    for (const call of completion.toolCalls) {
      const result = await executeTool(call.name, call.args, ctx);
      messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result });
    }

    if (round === MAX_TOOL_ROUNDS) {
      reply =
        (completion.text || roundText).trim() ||
        'تعذّر إكمال الطلب بالكامل الآن. حوّلني لزميل بشري إن احتجت.';
    }
  }

  return { reply, tokensUsed };
}
