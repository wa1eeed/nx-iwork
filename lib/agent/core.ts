// Shared agent-loop core, used by both chat (lib/agent/run.ts) and task
// execution (lib/agent/task.ts). Keeping the loading + tool-loop here means the
// "how an agent thinks" logic lives in one place; callers only differ in how
// they source the prompt and persist the outcome.

import { db } from '@/lib/db';
import type { AiMessage, AiProvider } from '@/lib/ai';
import { AGENT_TOOLS, executeTool, type ToolContext } from './tools';

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
  const { provider, system, messages, tier, temperature, maxTokens, ctx } = args;
  let reply = '';
  let tokensUsed = 0;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const completion = await provider.complete({
      system,
      messages,
      tier,
      temperature,
      maxTokens,
      tools: AGENT_TOOLS,
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
