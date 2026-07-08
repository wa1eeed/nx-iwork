'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import type { BookingStatus } from '@prisma/client';

type Result = { ok: true } | { ok: false; error: string };

const ALLOWED: BookingStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Per-service booking config + weekly availability windows — the entry point that
// makes a catalog service "bookable" by the deterministic engine.
const availabilitySchema = z.object({
  serviceId: z.string().trim().min(1),
  durationMin: z.coerce.number().int().min(5).max(1440).nullable(),
  bufferMin: z.coerce.number().int().min(0).max(240),
  maxCapacity: z.coerce.number().int().min(1).max(1000),
  windows: z
    .array(
      z.object({
        dayOfWeek: z.coerce.number().int().min(0).max(6),
        startTime: z.string().regex(HHMM),
        endTime: z.string().regex(HHMM),
      }),
    )
    .max(60),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;

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

// Save a service's booking config + weekly availability (replace-all). Making a
// service bookable = set durationMin AND add >=1 window. Tenant-scoped: the
// service is verified to belong to the company before any write.
export async function saveServiceAvailability(raw: AvailabilityInput): Promise<Result> {
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const parsed = availabilitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  // Reject windows where end <= start (empty/invalid range).
  if (d.windows.some((w) => w.endTime <= w.startTime)) return { ok: false, error: 'invalid_window' };

  const svc = await db.service.findFirst({
    where: { id: d.serviceId, companyId },
    select: { id: true },
  });
  if (!svc) return { ok: false, error: 'not_found' };

  await db.$transaction([
    db.service.update({
      where: { id: d.serviceId },
      data: { durationMin: d.durationMin, bufferMin: d.bufferMin, maxCapacity: d.maxCapacity },
    }),
    db.serviceAvailability.deleteMany({ where: { serviceId: d.serviceId } }),
    db.serviceAvailability.createMany({
      data: d.windows.map((w) => ({
        companyId,
        serviceId: d.serviceId,
        dayOfWeek: w.dayOfWeek,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
    }),
  ]);

  revalidatePath('/bookings/availability');
  revalidatePath('/bookings');
  return { ok: true };
}
