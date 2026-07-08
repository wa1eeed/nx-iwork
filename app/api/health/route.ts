import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { APP_ENV, integrationStatus } from '@/lib/env';

// Public, unauthenticated liveness/readiness probe. Returns NO secrets — only
// the deployment env, a DB round-trip result, and which integrations are wired
// (booleans + payments test/live posture). Use it for the Coolify health check
// and an external uptime monitor.
//
//   curl -s https://bznss.one/api/health
//   → 200 {"ok":true,...} when healthy, 503 when the DB is unreachable.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let database = false;
  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const ok = database;
  return NextResponse.json(
    {
      ok,
      service: 'nx-iwork',
      env: APP_ENV,
      database,
      integrations: integrationStatus(),
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}
