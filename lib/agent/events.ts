// Event dispatcher for proactive automation.
//
// When something happens in the platform (a new lead, a paid order, …) we call
// dispatchEvent(). It finds the company's active EventTriggers for that event
// and creates a PENDING task for each target agent. The scheduler/cron then
// executes those tasks (see runPendingEventTasks in scheduler.ts), so the agent
// "wakes up" without anyone in the loop.

import type { TriggerEvent } from '@prisma/client';
import { db } from '@/lib/db';

export interface EventContext {
  /** Short human context interpolated into the task (e.g. the lead's name). */
  summary?: string;
  /** Arbitrary payload stored on the task for the agent/audit. */
  metadata?: Record<string, unknown>;
}

export async function dispatchEvent(
  companyId: string,
  event: TriggerEvent,
  ctx: EventContext = {}
): Promise<number> {
  const triggers = await db.eventTrigger.findMany({
    // Only fire triggers whose target agent is genuinely active — otherwise we'd
    // queue PENDING tasks for a paused/archived agent that the scheduler would
    // (correctly) never run, leaving orphans.
    where: { companyId, event, isActive: true, agent: { status: { in: ['ONLINE', 'WORKING'] } } },
    select: { id: true, agentId: true, name: true, taskTemplate: true },
  });
  if (triggers.length === 0) return 0;

  for (const t of triggers) {
    const description = ctx.summary
      ? `${t.taskTemplate}\n\nسياق الحدث: ${ctx.summary}`
      : t.taskTemplate;
    await db.$transaction([
      db.task.create({
        data: {
          companyId,
          agentId: t.agentId,
          kind: 'AGENT_TASK',
          title: t.name,
          description,
          triggerType: 'EVENT',
          triggerSource: { triggerId: t.id, event, ...ctx.metadata },
        },
      }),
      db.eventTrigger.update({
        where: { id: t.id },
        data: { lastFiredAt: new Date(), fireCount: { increment: 1 } },
      }),
    ]);
  }
  return triggers.length;
}
