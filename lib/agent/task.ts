// Task execution engine: an agent performs a real task (not just chat).
//
// Lifecycle: PENDING/WORKING -> run the shared tool-loop with the task as the
// instruction -> DONE or FAILED, with a TaskAttempt row, a TimelineEvent, and
// agent stats updated. Invoked manually now ("run now") and by the scheduler
// later — same engine either way.

import { db } from '@/lib/db';
import { getProviderForCompany } from '@/lib/ai';
import type { AiMessage } from '@/lib/ai';
import { checkTokenBudget, chargeTokens } from '@/lib/billing/tokens';
import { checkAgentBudget, chargeAgentTokens } from '@/lib/billing/agent-tokens';
import { buildSystemPrompt } from './prompt';
import { loadAgentWithContext, runToolLoop, agentModelId } from './core';
import { recallMemoryBlock } from './memory';
import { getToolsForAgent } from './tools';

export type RunTaskResult =
  | { ok: true; result: string; tokensUsed: number }
  | {
      ok: false;
      reason:
        | 'task_not_found'
        | 'no_agent'
        | 'no_key'
        | 'no_settings'
        | 'decrypt_failed'
        | 'vertex_not_configured'
        | 'billing_limit'
        | 'already_running'
        | 'provider_error';
      message?: string;
    };

// Frames the task for the agent: it's executing an assigned job, and should end
// with a concise report of what it did.
function buildTaskInstruction(title: string, description: string): string {
  return [
    'لديك المهمة التالية لتنفيذها الآن. استخدم أدواتك عند الحاجة (الكتالوج، الـ CRM، إنشاء المهام).',
    `العنوان: ${title}`,
    description && description !== title ? `التفاصيل: ${description}` : '',
    'نفّذ المهمة، ثم اكتب تقريراً موجزاً بما أنجزته.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runAgentTask(
  taskId: string,
  companyId: string
): Promise<RunTaskResult> {
  const task = await db.task.findFirst({
    where: { id: taskId, companyId },
    select: { id: true, agentId: true, title: true, description: true, status: true },
  });
  if (!task) return { ok: false, reason: 'task_not_found' };
  if (!task.agentId) return { ok: false, reason: 'no_agent' };

  const agent = await loadAgentWithContext(task.agentId, companyId);
  if (!agent) return { ok: false, reason: 'no_agent' };

  const providerResult = await getProviderForCompany(companyId);
  if (!providerResult.ok) return { ok: false, reason: providerResult.reason };

  // Managed mode: refuse before spending if the token bank is empty.
  const budget = await checkTokenBudget(companyId);
  if (!budget.ok) return { ok: false, reason: budget.reason };
  const agentBudget = await checkAgentBudget(agent.id);
  if (!agentBudget.ok) return { ok: false, reason: 'billing_limit' };

  // Atomically CLAIM the task before doing any work. Two runners (the standalone
  // scheduler + the /api/cron/run endpoint, or overlapping ticks) can both reach
  // here for the same PENDING task; the conditional updateMany lets exactly one
  // win. A task already WORKING is being run by someone else → bail. Re-runnable
  // terminal states (PENDING/FAILED/BLOCKED/DONE) are still claimable so "run
  // now" and retries work; mid-approval/review/cancelled tasks are not force-run.
  const startedAt = new Date();
  const claim = await db.task.updateMany({
    where: { id: taskId, companyId, status: { in: ['PENDING', 'FAILED', 'BLOCKED', 'DONE'] } },
    data: { status: 'WORKING', startedAt, progress: 10 },
  });
  if (claim.count === 0) return { ok: false, reason: 'already_running' };

  const attemptNumber =
    (await db.taskAttempt.count({ where: { taskId } })) + 1;
  await db.taskAttempt.create({
    data: {
      taskId,
      agentId: agent.id,
      companyId,
      attemptNumber,
      status: 'RUNNING',
      startedAt,
    },
  });

  let system = buildSystemPrompt({
    agent,
    company: agent.company,
    dna: agent.company.companyDNA,
    settings: agent.company.settings,
    guardrails: agent.company, // enforce owner governance during autonomous runs
    audience: 'internal', // autonomous task on the business's behalf, not a customer chat
  });
  const memoryBlock = await recallMemoryBlock(
    agent.id,
    companyId,
    `${task.title}\n${task.description}`
  );
  if (memoryBlock) system += `\n\n${memoryBlock}`;

  const messages: AiMessage[] = [
    { role: 'user', content: buildTaskInstruction(task.title, task.description) },
  ];

  try {
    const { reply, tokensUsed } = await runToolLoop({
      provider: providerResult.provider,
      system,
      messages,
      tier: agent.model,
      model: agentModelId(agent.aiModel, providerResult.provider.id),
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      tools: getToolsForAgent(agent.company, agent.permissions),
      ctx: { companyId, agentId: agent.id },
    });

    const endedAt = new Date();
    await db.$transaction([
      db.task.update({
        where: { id: taskId },
        data: {
          status: 'DONE',
          result: reply,
          progress: 100,
          completedAt: endedAt,
          tokensUsed: { increment: tokensUsed },
        },
      }),
      db.taskAttempt.updateMany({
        where: { taskId, attemptNumber },
        data: { status: 'SUCCEEDED', endedAt, tokensUsed },
      }),
      db.agent.update({
        where: { id: agent.id },
        data: {
          tasksCompleted: { increment: 1 },
          totalTokensUsed: { increment: tokensUsed },
        },
      }),
      db.timelineEvent.create({
        data: {
          companyId,
          agentId: agent.id,
          type: 'TASK_COMPLETED',
          title: `أنجز ${agent.name} مهمة: ${task.title}`,
        },
      }),
    ]);

    // Managed mode: bill the token bank (no-op in BYOK).
    const remaining = await chargeTokens(companyId, tokensUsed);
    await chargeAgentTokens(agent.id, tokensUsed);
    console.log(`[token-guard] task | tenant=${companyId} | agent=${agent.id} | used=${tokensUsed} | remaining=${remaining ?? 'BYOK'}`);

    return { ok: true, result: reply, tokensUsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('runAgentTask failed', { taskId, companyId, err });
    const endedAt = new Date();
    await db.$transaction([
      db.task.update({
        where: { id: taskId },
        data: { status: 'FAILED', notes: message.slice(0, 500) },
      }),
      db.taskAttempt.updateMany({
        where: { taskId, attemptNumber },
        data: {
          status: 'FAILED',
          endedAt,
          errorReason: message.slice(0, 500),
          errorType: 'PROVIDER_ERROR',
        },
      }),
      db.agent.update({
        where: { id: agent.id },
        data: { tasksFailed: { increment: 1 } },
      }),
      db.timelineEvent.create({
        data: {
          companyId,
          agentId: agent.id,
          type: 'TASK_FAILED',
          title: `فشلت مهمة ${task.title}`,
          description: message.slice(0, 500),
        },
      }),
    ]);

    return { ok: false, reason: 'provider_error', message };
  }
}
