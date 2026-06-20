import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SLUG_REGEX } from '@/lib/validators/onboarding';
import { isReservedSlug } from '@/lib/reserved-slugs';

export type SlugCheckResult = {
  slug: string;
  available: boolean;
  reason?: 'invalid' | 'reserved' | 'taken';
};

// GET /api/onboarding/slug-check?slug=acme — live username availability for the
// onboarding wizard. Auth-gated so it can't be used to enumerate tenants.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const slug = (new URL(req.url).searchParams.get('slug') || '').trim().toLowerCase();

  if (slug.length < 2 || slug.length > 40 || !SLUG_REGEX.test(slug)) {
    return NextResponse.json<SlugCheckResult>({ slug, available: false, reason: 'invalid' });
  }
  if (isReservedSlug(slug)) {
    return NextResponse.json<SlugCheckResult>({ slug, available: false, reason: 'reserved' });
  }

  const existing = await db.company.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return NextResponse.json<SlugCheckResult>({ slug, available: false, reason: 'taken' });
  }

  return NextResponse.json<SlugCheckResult>({ slug, available: true });
}
