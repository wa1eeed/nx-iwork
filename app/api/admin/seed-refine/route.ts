import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { seedRefine } from '@/lib/seed/refine';

// One-off seeder for the Refine Medical Complex client demo, callable from inside
// the production image (the standalone runner ships API routes but not scripts/ +
// tsx, so `npm run seed:refine` can't run there). It only ever wipes + rebuilds
// the single 'refine' demo tenant.
//
// Protected by CRON_SECRET (reused — already set for the scheduler). If it's
// unset the endpoint is disabled (503). From the Coolify app container:
//   curl -fsS -X POST -H "x-seed-secret: $CRON_SECRET" \
//     http://127.0.0.1:3000/api/admin/seed-refine
// (or externally, POST https://<domain>/api/admin/seed-refine with the header).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get('x-seed-secret') ??
    new URL(req.url).searchParams.get('secret') ??
    '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await seedRefine();
    return NextResponse.json(result);
  } catch (err) {
    console.error('seed-refine route failed', err);
    return NextResponse.json({ ok: false, reason: 'error', message: String(err) }, { status: 500 });
  }
}
