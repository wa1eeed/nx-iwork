import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Tiny build marker so we can tell WHICH build is actually serving (Coolify
// queues sequential deploys, so "pushed" ≠ "live"). `marker` is bumped by hand
// on deploys we need to verify; SOURCE_COMMIT is injected by Coolify when
// available. No secrets — a short marker + commit sha only.
//
// Also surfaces the autonomous-engine heartbeat (PlatformSettings.lastCronRunAt,
// stamped every tick by /api/cron/run) so we can tell — WITHOUT logging in —
// whether the scheduler/worker is actually running. All autonomous behavior
// (scheduled tasks, event tasks, approval resume, delegation, dependency chains)
// is inert unless this heartbeat is fresh. No secrets exposed — just a timestamp.
export const dynamic = 'force-dynamic';

const MARKER = 'dashboard-ibp-polish-1';
// Fresher than this ⇒ the runner is alive (cron fires ~every 60s).
const CRON_HEALTHY_WINDOW_MS = 3 * 60 * 1000;

export async function GET() {
  let cron: { lastRunAt: string | null; secondsAgo: number | null; healthy: boolean } = {
    lastRunAt: null,
    secondsAgo: null,
    healthy: false,
  };
  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: 'singleton' },
      select: { lastCronRunAt: true },
    });
    if (settings?.lastCronRunAt) {
      const ms = Date.now() - settings.lastCronRunAt.getTime();
      cron = {
        lastRunAt: settings.lastCronRunAt.toISOString(),
        secondsAgo: Math.round(ms / 1000),
        healthy: ms < CRON_HEALTHY_WINDOW_MS,
      };
    }
  } catch {
    /* heartbeat is best-effort; never fail the version probe on a DB hiccup */
  }

  return NextResponse.json({
    marker: MARKER,
    commit: (process.env.SOURCE_COMMIT ?? process.env.COOLIFY_COMMIT ?? 'unknown').slice(0, 12),
    cron,
  });
}
