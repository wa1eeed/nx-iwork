import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';

// Top up the demo tenants' AI-token budget from inside the production image.
// The demo tenants (/refine, /basma, /almaali, /khedmatak) get drained by
// hands-on testing, and when a company's tokenBalance hits 0 its public chat
// widget returns billing_limit ("the assistant is busy") — which reads to us as
// "the chat is broken". This restores them WITHOUT re-seeding (so their bookings
// / orders / conversations survive).
//
// SAFE BY CONSTRUCTION: only the hard-coded demo slugs are touched, balances are
// only ever RAISED to the target (never lowered), and per-agent monthly usage is
// cleared so no agent is left over its cap. Real paying tenants are untouchable
// through this route.
//
// Protected by CRON_SECRET (same secret as the scheduler + seed-refine). Disabled
// (503) when the secret is unset. From the Coolify app container:
//   curl -fsS -X POST -H "x-seed-secret: $CRON_SECRET" \
//     http://127.0.0.1:3000/api/admin/refill-demos
// (or externally, POST https://<domain>/api/admin/refill-demos with the header).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_SLUGS = ['refine', 'basma', 'almaali', 'khedmatak'];
const TARGET_BALANCE = 5_000_000;

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
    const companies = await db.company.findMany({
      where: { slug: { in: DEMO_SLUGS } },
      select: { id: true, slug: true, tokenBalance: true },
    });

    const now = new Date();
    const results: { slug: string; before: number; after: number; agentsReset: number }[] = [];
    for (const c of companies) {
      const after = Math.max(c.tokenBalance, TARGET_BALANCE); // never lowers
      const [, agents] = await db.$transaction([
        db.company.update({ where: { id: c.id }, data: { tokenBalance: after } }),
        // Clear the per-agent monthly ceiling too, so an agent that hit its cap
        // this month can serve again immediately.
        db.agent.updateMany({
          where: { companyId: c.id },
          data: { periodTokensUsed: 0, periodStartedAt: now },
        }),
      ]);
      results.push({ slug: c.slug, before: c.tokenBalance, after, agentsReset: agents.count });
    }

    return NextResponse.json({ ok: true, target: TARGET_BALANCE, restored: results });
  } catch (err) {
    console.error('refill-demos route failed', err);
    return NextResponse.json({ ok: false, reason: 'error', message: String(err) }, { status: 500 });
  }
}
