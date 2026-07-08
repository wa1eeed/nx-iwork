'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import type { BookingStatus } from '@prisma/client';

type Result = { ok: true } | { ok: false; error: string };

const ALLOWED: BookingStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

async function authedCompany(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

// Owner-driven booking lifecycle from the calendar (confirm / complete / cancel).
// Tenant-scoped: the updateMany where-clause pins companyId so one tenant can
// never mutate another's booking.
export async function setBookingStatus(id: string, status: BookingStatus): Promise<Result> {
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthenticated' };
  if (!ALLOWED.includes(status)) return { ok: false, error: 'invalid_status' };

  const res = await db.booking.updateMany({ where: { id, companyId }, data: { status } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/bookings');
  return { ok: true };
}
