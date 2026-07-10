import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Small in-memory rate limiter per IP (single-instance; a shared store is the
// scaling upgrade). Stops obvious review spam.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60_000; // 1 hour
const MAX_PER_WINDOW = 5;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > MAX_PER_WINDOW;
}

// A visitor submits a review for the business. Always created PENDING — the owner
// moderates before it shows on the site.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: { authorName?: unknown; rating?: unknown; comment?: unknown; serviceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const authorName = typeof body.authorName === 'string' ? body.authorName.trim().slice(0, 80) : '';
  const rating = Math.round(Number(body.rating));
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : '';
  const serviceId = typeof body.serviceId === 'string' && body.serviceId ? body.serviceId : null;

  if (!authorName || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(`${slug}:${ip}`)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const company = await db.company.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!company || company.status === 'SUSPENDED') {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 404 });
  }

  // Only accept a serviceId that belongs to this company.
  let validServiceId: string | null = null;
  if (serviceId) {
    const svc = await db.service.findFirst({
      where: { id: serviceId, companyId: company.id },
      select: { id: true },
    });
    validServiceId = svc?.id ?? null;
  }

  await db.review.create({
    data: {
      companyId: company.id,
      serviceId: validServiceId,
      authorName,
      rating,
      comment: comment || null,
      status: 'PENDING',
    },
  });

  return NextResponse.json({ ok: true });
}
