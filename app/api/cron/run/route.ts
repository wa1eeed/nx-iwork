import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { runDueSchedules, runDueTasks, runDueReminders, runReapStuckTasks } from '@/lib/agent/scheduler';
import { runDueRenewals } from '@/lib/billing/renewals';

// Cron trigger for the scheduler, callable from inside the production image
// (it's part of the Next build, unlike scripts/scheduler.ts which needs tsx +
// the scripts/ dir that the standalone runner doesn't ship).
//
// Trigger it once a minute. On Coolify, add a Scheduled Task on the app service:
//   * * * * *   curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" \
//                 http://127.0.0.1:3000/api/cron/run
// (or any external cron hitting https://<domain>/api/cron/run with the header).
//
// Protected by CRON_SECRET — if it's unset the endpoint is disabled (503), so a
// missing secret can never leave an open, cost-incurring trigger.

export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret') ??
    '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // timingSafeEqual requires equal lengths; length mismatch = not equal.
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, reason: 'cron_disabled' }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  try {
    const [schedules, events, reminders, reaped, renewals] = await Promise.all([
      runDueSchedules(),
      runDueTasks(),
      runDueReminders(),
      runReapStuckTasks(),
      // Subscription auto-renewal pass (due scan → saved-card charge → dunning).
      runDueRenewals(),
    ]);
    // Heartbeat: stamp that autonomous execution ran, so the dashboard can prove
    // it's alive and warn the owner if the cron ever stops firing.
    const summary = { schedules, events, reminders, reaped, renewals };
    const summaryJson = summary as unknown as Prisma.InputJsonValue;
    await db.platformSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastCronRunAt: new Date(), lastCronSummary: summaryJson },
      update: { lastCronRunAt: new Date(), lastCronSummary: summaryJson },
    });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('cron run failed', err);
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handle(req);
}

// Allow GET too — some cron services only issue GET requests.
export async function GET(req: Request) {
  return handle(req);
}
