'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import type { ReviewStatus } from '@prisma/client';

type Result = { ok: true } | { ok: false; error: string };

async function authedCompany(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

const statusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(['PENDING', 'PUBLISHED', 'HIDDEN']),
});

// Owner moderation: publish or hide a review. Tenant-scoped via updateMany.
export async function setReviewStatus(input: z.infer<typeof statusSchema>): Promise<Result> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthorized' };

  const res = await db.review.updateMany({
    where: { id: parsed.data.id, companyId },
    data: { status: parsed.data.status as ReviewStatus },
  });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/reviews');
  return { ok: true };
}

export async function deleteReview(id: string): Promise<Result> {
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthorized' };
  const res = await db.review.deleteMany({ where: { id, companyId } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/reviews');
  return { ok: true };
}
