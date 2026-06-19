// The Agent Loop (v2): the beating heart of an AI employee.
//
// Flow: load agent + company context -> build system prompt -> pull recent
// conversation (working memory) -> call the company's AI provider in a
// tool-use loop (the model may call catalog/CRM/task tools, we run them and
// feed results back) until it produces a final reply -> persist the turn and
// update token stats.
//
// The episodic + semantic memory layers plug into this same function later
// without changing its callers.

import { db } from '@/lib/db';
import { getProviderForCompany } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { buildSystemPrompt } from './prompt';
import { AGENT_TOOLS, executeTool } from './tools';

// How many recent messages form the agent's "working memory". Kept small to
// bound token cost; older context will come from episodic/semantic memory.
const WORKING_MEMORY_LIMIT = 20;

// Safety cap on tool round-trips per turn, so a confused model can't loop
// forever (and rack up tokens).
const MAX_TOOL_ROUNDS = 5;

export type RunAgentResult =
  | { ok: true; reply: string; tokensUsed: number }
  | {
      ok: false;
      reason: 'agent_not_found' | 'no_key' | 'no_settings' | 'decrypt_failed' | 'provider_error';
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

  const agent = await db.agent.findFirst({
    // findFirst with companyId enforces tenant isolation: an agent id alone is
    // never enough to reach across companies.
    where: { id: agentId, companyId },
    include: {
      company: {
        select: {
          name: true,
          nameEn: true,
          brandVoice: true,
          industry: true,
          companyDNA: {
            select: {
              aboutUs: true,
              policies: true,
              tone: true,
              targetAudience: true,
            },
          },
          settings: { select: { primaryLanguage: true } },
        },
      },
    },
  });

  if (!agent) return { ok: false, reason: 'agent_not_found' };

  const providerResult = await getProviderForCompany(companyId);
  if (!providerResult.ok) {
    return { ok: false, reason: providerResult.reason };
  }

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

  const system = buildSystemPrompt({
    agent,
    company: agent.company,
    dna: agent.company.companyDNA,
    settings: agent.company.settings,
  });

  const ctx = { companyId, agentId };
  let reply = '';
  let tokensUsed = 0;

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const completion = await providerResult.provider.complete({
        system,
        messages,
        tier: agent.model,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        tools: AGENT_TOOLS,
      });
      tokensUsed += completion.usage.inputTokens + completion.usage.outputTokens;

      if (!completion.needsTools || completion.toolCalls.length === 0) {
        reply = completion.text.trim();
        break;
      }

      // Record the model's tool-call turn, run each tool, and feed results back.
      messages.push({
        role: 'assistant',
        content: completion.text,
        toolCalls: completion.toolCalls,
      });
      for (const call of completion.toolCalls) {
        const result = await executeTool(call.name, call.args, ctx);
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: result,
        });
      }

      // Out of rounds but the model still wants tools: fall back to its text.
      if (round === MAX_TOOL_ROUNDS) {
        reply =
          completion.text.trim() ||
          'تعذّر إكمال الطلب بالكامل الآن. حوّلني لزميل بشري إن احتجت.';
      }
    }
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

  return { ok: true, reply, tokensUsed };
}
