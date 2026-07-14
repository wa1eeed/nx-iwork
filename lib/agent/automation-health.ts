// Automation health — reads the cron heartbeat (PlatformSettings.lastCronRunAt,
// stamped every minute by /api/cron/run) so the dashboard can PROVE autonomous
// execution is alive and warn the owner if it stops. This is what makes "agents
// act on their own, without being woken" verifiable instead of a leap of faith.

import { db } from '@/lib/db';

export interface AutomationHealth {
  status: 'healthy' | 'stale' | 'never';
  agoLabel: string | null; // compact "32s" / "4m" / "2h"
}

function agoLabel(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86_400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86_400)}d`;
}

export async function getAutomationHealth(now: Date = new Date()): Promise<AutomationHealth> {
  const s = await db.platformSettings
    .findUnique({ where: { id: 'singleton' }, select: { lastCronRunAt: true } })
    .catch(() => null);
  const last = s?.lastCronRunAt ?? null;
  if (!last) return { status: 'never', agoLabel: null };
  const sec = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 1000));
  // Healthy if the every-minute cron has fired within the last 5 minutes.
  return { status: sec <= 300 ? 'healthy' : 'stale', agoLabel: agoLabel(sec) };
}
