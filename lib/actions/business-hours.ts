'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

type Result = { ok: true } | { ok: false; error: string };

async function authedCompany(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const hoursSchema = z.object({
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

// Replace the company's whole weekly-hours set atomically (delete + recreate).
// A service with no availability windows of its own inherits these.
export async function saveCompanyHours(input: z.infer<typeof hoursSchema>): Promise<Result> {
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthorized' };

  // Reject windows where end isn't after start.
  for (const w of parsed.data.windows) {
    if (w.endTime <= w.startTime) return { ok: false, error: 'bad_window' };
  }
  // De-dupe on (day,start) so the unique index can't trip.
  const seen = new Set<string>();
  const rows = parsed.data.windows.filter((w) => {
    const k = `${w.dayOfWeek}-${w.startTime}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  await db.$transaction([
    db.companyHours.deleteMany({ where: { companyId } }),
    db.companyHours.createMany({ data: rows.map((w) => ({ companyId, ...w })) }),
  ]);
  revalidatePath('/settings');
  return { ok: true };
}

const holidaySchema = z.object({
  date: z.string().regex(ISO_DATE),
  name: z.string().trim().min(1).max(120),
});

export async function addHoliday(input: z.infer<typeof holidaySchema>): Promise<Result> {
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthorized' };

  // upsert on the unique (companyId, date) so re-adding the same day just renames.
  await db.holiday.upsert({
    where: { companyId_date: { companyId, date: parsed.data.date } },
    update: { name: parsed.data.name },
    create: { companyId, date: parsed.data.date, name: parsed.data.name },
  });
  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteHoliday(id: string): Promise<Result> {
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthorized' };
  const res = await db.holiday.deleteMany({ where: { id, companyId } });
  if (res.count === 0) return { ok: false, error: 'not_found' };
  revalidatePath('/settings');
  return { ok: true };
}

// Free-text cancellation/booking policy shown to customers.
export async function saveCancellationPolicy(text: string): Promise<Result> {
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthorized' };
  await db.businessSettings.update({
    where: { companyId },
    data: { cancellationPolicy: text.trim().slice(0, 2000) || null },
  });
  revalidatePath('/settings');
  return { ok: true };
}
