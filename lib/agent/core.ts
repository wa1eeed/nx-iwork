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
          settings: { select: { primaryLanguage: true } },
        },
      },
    },
  });
}

export interface ToolLoopArgs {
  provider: AiProvider;
  system: string;
  messages: AiMessage[]; // mutated in place with tool turns
  tier: 'HAIKU' | 'SONNET' | 'OPUS';
  temperature: number;
  maxTokens: number;
  /** The tools to offer — already filtered to the company's enabled modules. */
  tools: AiTool[];
  ctx: ToolContext;
}

export interface ToolLoopResult {
  reply: string;
  tokensUsed: number;
}

// Runs the provider in a tool-use loop until it produces a final answer (or the
// round cap is hit). Throws on provider error; callers map that to their own
// failure shape.
export async function runToolLoop(args: ToolLoopArgs): Promise<ToolLoopResult> {
  const { provider, system, messages, tier, temperature, maxTokens, tools, ctx } = args;
  let reply = '';
  let tokensUsed = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const completion = await provider.complete({
      system,
      messages,
      tier,
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
  const { provider, system, messages, tier, temperature, maxTokens, tools, ctx } = args;
  if (!provider.completeStream) {
    const r = await runToolLoop(args);
    onDelta(r.reply);
    return r;
  }

  let reply = '';
  let tokensUsed = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const gen = provider.completeStream({ system, messages, tier, temperature, maxTokens, tools });
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
