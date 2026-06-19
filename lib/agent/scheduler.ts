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

export async function runDueSchedules(now: Date = new Date()): Promise<SchedulerRunSummary> {
  const due = await db.agentSchedule.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
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
