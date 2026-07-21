import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { runDueSchedules, runDueTasks, runDueReminders, runReapStuckTasks } from '@/lib/agent/scheduler';
import { runDueRenewals } from '@/lib/billing/renewals';

// The single autonomous-engine pass, shared by the HTTP trigger (/api/cron/run,
// for an external cron) and the in-process self-scheduler (instrumentation.ts,
// for CRON_SELF=1). Keeping the body in one place means both paths run exactly
// the same work + stamp the same heartbeat.

export type CronSummary = {
  schedules: Awaited<ReturnType<typeof runDueSchedules>>;
  events: Awaited<ReturnType<typeof runDueTasks>>;
  reminders: Awaited<ReturnType<typeof runDueReminders>>;
  reaped: Awaited<ReturnType<typeof runReapStuckTasks>>;
  renewals: Awaited<ReturnType<typeof runDueRenewals>>;
};

// Run one full pass (scheduled tasks · event tasks · reminders · stuck-task reap ·
// subscription renewals) and stamp the heartbeat so /api/version can prove the
// engine is alive.
export async function runCronWork(): Promise<CronSummary> {
  const [schedules, events, reminders, reaped, renewals] = await Promise.all([
    runDueSchedules(),
    runDueTasks(),
    runDueReminders(),
    runReapStuckTasks(),
    runDueRenewals(),
  ]);
  const summary: CronSummary = { schedules, events, reminders, reaped, renewals };
  await db.platformSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      lastCronRunAt: new Date(),
      lastCronSummary: summary as unknown as Prisma.InputJsonValue,
    },
    update: {
      lastCronRunAt: new Date(),
      lastCronSummary: summary as unknown as Prisma.InputJsonValue,
    },
  });
  return summary;
}

// Single-flight claim for the in-process scheduler. Atomically wins the tick only
// if no one has run within `minIntervalMs` — so several app replicas (or an
// overlapping tick) never run the pass twice in the same window. Implemented with
// a conditional updateMany on the heartbeat row: it's one atomic statement, safe
// under connection pooling (unlike session-scoped `pg_advisory_lock`, which can
// lock and unlock on different pooled connections). Returns the summary if we won
// the lease, else null. (The renewal path also advances each subscription's
// cursor before charging, so money is protected even in the impossible-overlap
// case.)
export async function runLeasedCronTick(minIntervalMs = 55_000): Promise<CronSummary | null> {
  const cutoff = new Date(Date.now() - minIntervalMs);
  // Ensure the singleton row exists (no-op once present) so the claim can match.
  await db.platformSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });
  const claim = await db.platformSettings.updateMany({
    where: { id: 'singleton', OR: [{ lastCronRunAt: null }, { lastCronRunAt: { lt: cutoff } }] },
    data: { lastCronRunAt: new Date() },
  });
  if (claim.count === 0) return null; // another replica/tick owns this window
  return runCronWork();
}
