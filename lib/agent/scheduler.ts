// Scheduler core: the function that makes agents move on their own.
//
// runDueSchedules() finds every active AgentSchedule whose nextRunAt has passed,
// turns each into a Task, runs it through the task engine, then advances
// nextRunAt to the following cron tick. It's invoked by the standalone worker
// (scripts/scheduler.ts) every minute — kept as a plain function so it's
// testable and could also be triggered by an external cron/HTTP if preferred.
//
// Designed to run as a SINGLE worker instance: one scheduler process avoids the
// duplicate-fire problem you'd get from in-process cron across web replicas.

import { db } from '@/lib/db';
import { runAgentTask } from './task';
import { computeNextRun } from './schedule-time';

export interface SchedulerRunSummary {
  due: number;
  ran: number;
  failed: number;
}

export async function runDueSchedules(
  now: Date = new Date(),
  companyId?: string
): Promise<SchedulerRunSummary> {
  const due = await db.agentSchedule.findMany({
    // Guardrails: skip tenants whose owner paused automation — every agent in
    // that company is effectively off until they flip it back on. Also skip
    // individually paused agents (the "Pause agent" workspace action).
    // `companyId` scopes to one tenant (owner-triggered "run automation now").
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      company: { automationEnabled: true },
      agent: { status: { not: 'PAUSED' } },
      ...(companyId ? { companyId } : {}),
    },
    select: {
      id: true,
      companyId: true,
      agentId: true,
      name: true,
      taskTemplate: true,
      cronExpression: true,
      timezone: true,
    },
    take: 100, // bound per tick; the rest fire on the next pass
  });

  let ran = 0;
  let failed = 0;

  for (const s of due) {
    // Advance the schedule FIRST so a slow/failing run can't cause it to fire
    // repeatedly within the same tick window.
    const next = computeNextRun(s.cronExpression, s.timezone, now);
    await db.agentSchedule.update({
      where: { id: s.id },
      data: {
        lastRunAt: now,
        nextRunAt: next, // null disables a now-invalid expression
        runCount: { increment: 1 },
      },
    });

    try {
      const task = await db.task.create({
        data: {
          companyId: s.companyId,
          agentId: s.agentId,
          kind: 'AGENT_TASK',
          title: s.name,
          description: s.taskTemplate,
          triggerType: 'SCHEDULE',
          triggerSource: { scheduleId: s.id },
        },
        select: { id: true },
      });

      const result = await runAgentTask(task.id, s.companyId);
      if (result.ok) ran += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error('Schedule run errored', { scheduleId: s.id, err });
    }
  }

  return { due: due.length, ran, failed };
}

// Runs any PENDING agent-initiated task that's due — so a request the owner
// makes in chat (the agent logs it via create_task → triggerType AGENT_TOOL) or
// an event trigger (triggerType EVENT) gets executed autonomously and is never
// ignored, even while the agent is busy with something else. Owner tasks created
// from the /tasks form (TASK_ASSIGNMENT) stay manual ("run" button). Tasks with
// a future dueAt wait until then.
export async function runDueTasks(
  now: Date = new Date(),
  limit = 50,
  companyId?: string
): Promise<SchedulerRunSummary> {
  const pending = await db.task.findMany({
    where: {
      status: 'PENDING',
      triggerType: { in: ['EVENT', 'AGENT_TOOL'] },
      agentId: { not: null },
      OR: [{ dueAt: null }, { dueAt: { lte: now } }],
      // Guardrails: paused tenants don't run — their pending tasks wait until
      // the owner re-enables automation. Paused agents are skipped too.
      // `companyId` scopes to one tenant (owner-triggered "run automation now").
      company: { automationEnabled: true },
      agent: { status: { not: 'PAUSED' } },
      ...(companyId ? { companyId } : {}),
    },
    select: { id: true, companyId: true, agentId: true, dependsOn: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  // Resolve dependency statuses in one batch so we can gate sequenced tasks
  // (depends_on) without an N+1 query. A missing dep is treated as satisfied so
  // a deleted prerequisite can never hang its dependents forever.
  const depIds = [...new Set(pending.flatMap((t) => t.dependsOn))];
  const depStatus = new Map<string, string>();
  if (depIds.length) {
    const deps = await db.task.findMany({
      where: { id: { in: depIds } },
      select: { id: true, status: true },
    });
    for (const d of deps) depStatus.set(d.id, d.status);
  }

  let ran = 0;
  let failed = 0;
  let skipped = 0;
  for (const t of pending) {
    if (t.dependsOn.length) {
      const statuses = t.dependsOn.map((id) => depStatus.get(id) ?? 'DONE');
      // A dead-end dependency (failed/cancelled) can never be satisfied → block
      // the dependent so it stops waiting, and surface it on the timeline.
      if (statuses.some((s) => s === 'FAILED' || s === 'CANCELLED')) {
        await db.task.update({
          where: { id: t.id },
          data: { status: 'BLOCKED', notes: 'مهمة سابقة تعتمد عليها فشلت أو أُلغيت.' },
        });
        if (t.agentId) {
          await db.timelineEvent.create({
            data: {
              companyId: t.companyId,
              agentId: t.agentId,
              type: 'TASK_BLOCKED',
              title: 'مهمة متوقّفة',
              description: 'تعذّر تنفيذها لأن مهمة سابقة تعتمد عليها لم تكتمل.',
            },
          });
        }
        continue;
      }
      // Not all prerequisites are DONE yet → leave it PENDING for a later tick.
      if (statuses.some((s) => s !== 'DONE')) {
        skipped += 1;
        continue;
      }
    }
    try {
      const result = await runAgentTask(t.id, t.companyId);
      if (result.ok) ran += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error('Pending event task errored', { taskId: t.id, err });
    }
  }
  return { due: pending.length - skipped, ran, failed };
}
