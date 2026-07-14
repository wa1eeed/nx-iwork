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
import { sendBookingReminder } from '@/lib/notifications/booking-emails';

export interface SchedulerRunSummary {
  due: number;
  ran: number;
  failed: number;
}

// Send pre-appointment reminders for bookings entering their reminder window.
// Runs every tick alongside the agent scheduler (see /api/cron/run). Each tenant
// sets its own lead time + on/off in Settings → Reminders. reminderSentAt is set
// only on success, so a transient mail failure simply retries next tick.
export async function runDueReminders(
  now: Date = new Date(),
  limitPerCompany = 100,
): Promise<{ sent: number; failed: number }> {
  const configs = await db.businessSettings.findMany({
    where: { bookingReminderEnabled: true },
    select: {
      companyId: true,
      bookingReminderHoursBefore: true,
      primaryLanguage: true,
      timezone: true,
    },
  });

  let sent = 0;
  let failed = 0;
  for (const cfg of configs) {
    const horizon = new Date(now.getTime() + cfg.bookingReminderHoursBefore * 3_600_000);
    const due = await db.booking.findMany({
      where: {
        companyId: cfg.companyId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        reminderSentAt: null,
        startAt: { gt: now, lte: horizon },
        customer: { email: { not: null } },
      },
      take: limitPerCompany,
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        ref: true,
        title: true,
        startAt: true,
        customer: { select: { name: true, email: true } },
        service: { select: { title: true } },
      },
    });

    const ar = (cfg.primaryLanguage ?? 'ar') === 'ar';
    const tz = cfg.timezone || 'Asia/Riyadh';
    for (const b of due) {
      if (!b.customer?.email) continue;
      try {
        await sendBookingReminder(
          cfg.companyId,
          {
            to: b.customer.email,
            customerName: b.customer.name || '',
            serviceTitle: b.service?.title || b.title,
            startAt: b.startAt,
            ref: b.ref,
          },
          { ar, tz },
        );
        await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: new Date() } });
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error('Booking reminder failed', { bookingId: b.id, err });
      }
    }
  }
  return { sent, failed };
}

// Crash recovery. A task is claimed (status WORKING + startedAt) before work
// begins; if the runner dies mid-run (a deploy/restart), it would hang in WORKING
// forever since runDueTasks only picks PENDING. This re-queues autonomous tasks
// stuck past the timeout so they retry — or FAILs them once they've burned the
// attempt cap, so nothing loops or hangs. Runs every tick from /api/cron/run.
export async function runReapStuckTasks(
  now: Date = new Date(),
  timeoutMs = 15 * 60_000,
  maxAttempts = 3
): Promise<{ reaped: number; failed: number }> {
  const cutoff = new Date(now.getTime() - timeoutMs);
  const stuck = await db.task.findMany({
    where: { status: 'WORKING', startedAt: { lt: cutoff } },
    select: { id: true, triggerType: true, _count: { select: { attempts: true } } },
    take: 100,
  });

  let reaped = 0;
  let failed = 0;
  for (const t of stuck) {
    // Only event/tool tasks auto-retry; a crashed scheduled/manual run is failed
    // (visible, re-runnable by hand) — its next schedule occurrence fires normally.
    const retryable =
      (t.triggerType === 'EVENT' || t.triggerType === 'AGENT_TOOL') && t._count.attempts < maxAttempts;
    if (retryable) {
      await db.task.update({ where: { id: t.id }, data: { status: 'PENDING', progress: 0 } });
      reaped += 1;
    } else {
      await db.task.update({
        where: { id: t.id },
        data: { status: 'FAILED', notes: 'توقّفت أثناء التنفيذ (على الأرجح إعادة تشغيل الخادم).' },
      });
      failed += 1;
    }
  }
  return { reaped, failed };
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
      // Only genuinely-active agents run — a paused, archived, offline, or
      // still-onboarding agent must not execute schedules or event/tool tasks.
      agent: { status: { in: ['ONLINE', 'WORKING'] } },
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
      // Only genuinely-active agents run — a paused, archived, offline, or
      // still-onboarding agent must not execute schedules or event/tool tasks.
      agent: { status: { in: ['ONLINE', 'WORKING'] } },
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
  // Keyed by `${companyId}:${taskId}` so a dependency is only ever resolved
  // within its own tenant — never read another company's task status.
  const depStatus = new Map<string, string>();
  if (depIds.length) {
    const deps = await db.task.findMany({
      where: { id: { in: depIds } },
      select: { id: true, status: true, companyId: true },
    });
    for (const d of deps) depStatus.set(`${d.companyId}:${d.id}`, d.status);
  }

  let ran = 0;
  let failed = 0;
  let skipped = 0;
  for (const t of pending) {
    if (t.dependsOn.length) {
      const statuses = t.dependsOn.map((id) => depStatus.get(`${t.companyId}:${id}`) ?? 'DONE');
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
      else if (result.reason === 'already_running') continue; // another runner claimed it
      else failed += 1;
    } catch (err) {
      failed += 1;
      console.error('Pending event task errored', { taskId: t.id, err });
    }
  }
  return { due: pending.length - skipped, ran, failed };
}
