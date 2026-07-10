// The deterministic bookings engine — the SYSTEM half of the two-layer contract.
// Slot generation, availability checks, and capacity-safe creation are all pure,
// server-side code. Agents never reimplement this: when granted the "bookings"
// permission they call tools (check_availability / create_booking) that route
// THROUGH this engine, so the booking logic stays reliable and centralized.

import { db } from '@/lib/db';
import { nextRef } from '@/lib/refs';
import type { BookingStatus, Prisma } from '@prisma/client';

export class BookingError extends Error {
  constructor(
    public code: 'not_bookable' | 'invalid_slot' | 'slot_full' | 'waitlist_full' | 'past' | 'service_not_found',
  ) {
    super(code);
    this.name = 'BookingError';
  }
}

export interface Slot {
  /** ISO start instant (UTC). */
  startAt: string;
  /** ISO end instant (UTC). */
  endAt: string;
  /** "HH:MM" in the business timezone, for display. */
  label: string;
  remaining: number;
  available: boolean;
  /** Full slot the customer may still join a waitlist for (service opt-in). */
  waitlist: boolean;
}

const ACTIVE_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Convert a wall-clock time (calendar date + "HH:MM") in an IANA timezone to the
// correct UTC instant. Dependency-free: guess in UTC, measure the zone offset at
// that instant via Intl, then correct. Accurate for fixed-offset zones (e.g.
// Asia/Riyadh) and correct except at the exact DST transition hour.
function zonedToUtc(y: number, mo: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(guess));
  const val = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let h = val('hour');
  if (h === 24) h = 0; // some engines render midnight as "24"
  const seenAsUtc = Date.UTC(val('year'), val('month') - 1, val('day'), h, val('minute'));
  return new Date(guess - (seenAsUtc - guess));
}

// Slot display label — 12-hour with Latin digits + Arabic meridiem (ص/م), e.g.
// "5:30 م". Display only; the real instants live in startAt/endAt.
function hhmm(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date);
}

function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

async function companyTz(companyId: string): Promise<string> {
  const s = await db.businessSettings.findUnique({
    where: { companyId },
    select: { timezone: true },
  });
  return s?.timezone || 'Asia/Riyadh';
}

type BookableService = {
  id: string;
  title: string;
  durationMin: number;
  bufferMin: number;
  maxCapacity: number;
  allowWaitlist: boolean;
  waitlistCapacity: number;
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
};

/**
 * A service is bookable when it has a duration AND at least one availability
 * window. Per-service windows take precedence; a service with none inherits the
 * company's default opening hours (CompanyHours), so hours can be set once for
 * the whole business instead of per service.
 */
export async function getBookableService(
  companyId: string,
  serviceId: string,
): Promise<BookableService | null> {
  const svc = await db.service.findFirst({
    where: { id: serviceId, companyId, isActive: true },
    select: {
      id: true, title: true, durationMin: true, bufferMin: true, maxCapacity: true,
      allowWaitlist: true, waitlistCapacity: true,
      availability: { select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  });
  if (!svc || !svc.durationMin) return null;
  let availability = svc.availability;
  if (availability.length === 0) {
    availability = await db.companyHours.findMany({
      where: { companyId },
      select: { dayOfWeek: true, startTime: true, endTime: true },
    });
  }
  if (availability.length === 0) return null;
  return { ...svc, durationMin: svc.durationMin, availability };
}

/** Is this business-local date (YYYY-MM-DD) a configured closure/holiday? */
export async function isHoliday(companyId: string, dateISO: string): Promise<boolean> {
  const h = await db.holiday.findFirst({
    where: { companyId, date: dateISO },
    select: { id: true },
  });
  return h !== null;
}

/**
 * Deterministic slot generation for one calendar day (business-local `YYYY-MM-DD`).
 * Slots are sized by durationMin and stepped by durationMin + bufferMin, bounded
 * by each availability window, exclude the past, and expose remaining capacity.
 */
export async function generateDaySlots(
  companyId: string,
  serviceId: string,
  dateISO: string,
  now: Date = new Date(),
): Promise<Slot[]> {
  const svc = await getBookableService(companyId, serviceId);
  if (!svc) return [];
  // The business is closed on a holiday → no slots that day.
  if (await isHoliday(companyId, dateISO)) return [];

  const tz = await companyTz(companyId);
  const [y, mo, d] = dateISO.split('-').map(Number);
  if (!y || !mo || !d) return [];
  // Weekday of the local calendar date (tz-independent for a bare date).
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const windows = svc.availability.filter((a) => a.dayOfWeek === dow);
  if (windows.length === 0) return [];

  const step = svc.durationMin + svc.bufferMin;
  const candidates: { start: Date; end: Date }[] = [];
  for (const w of windows) {
    const winStart = parseHM(w.startTime);
    const winEnd = parseHM(w.endTime);
    for (let t = winStart; t + svc.durationMin <= winEnd; t += step) {
      const start = zonedToUtc(y, mo, d, Math.floor(t / 60), t % 60, tz);
      if (start.getTime() <= now.getTime()) continue; // no past slots
      candidates.push({ start, end: new Date(start.getTime() + svc.durationMin * 60_000) });
    }
  }
  if (candidates.length === 0) return [];

  // One query for the day's active bookings on this service → capacity per start.
  const dayStart = zonedToUtc(y, mo, d, 0, 0, tz);
  const booked = await db.booking.findMany({
    where: {
      companyId,
      serviceId,
      status: { in: ACTIVE_STATUSES },
      startAt: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS + DAY_MS) },
    },
    select: { startAt: true },
  });
  const takenByStart = new Map<number, number>();
  for (const b of booked) {
    const k = b.startAt.getTime();
    takenByStart.set(k, (takenByStart.get(k) ?? 0) + 1);
  }

  return candidates
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map(({ start, end }) => {
      const remaining = svc.maxCapacity - (takenByStart.get(start.getTime()) ?? 0);
      const available = remaining > 0;
      return {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        label: hhmm(start, tz),
        remaining,
        available,
        waitlist: !available && svc.allowWaitlist,
      };
    });
}

/** Is `startAtISO` a real, still-open slot for this service? */
export async function checkSlotAvailable(
  companyId: string,
  serviceId: string,
  startAtISO: string,
  now: Date = new Date(),
): Promise<{ ok: boolean; endAt?: string; reason?: BookingError['code']; waitlist?: boolean }> {
  const start = new Date(startAtISO);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: 'invalid_slot' };
  if (start.getTime() <= now.getTime()) return { ok: false, reason: 'past' };
  const svc = await getBookableService(companyId, serviceId);
  if (!svc) return { ok: false, reason: 'not_bookable' };
  const dateISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: await companyTz(companyId), year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(start); // YYYY-MM-DD in the business tz
  const slot = (await generateDaySlots(companyId, serviceId, dateISO, now)).find(
    (s) => s.startAt === start.toISOString(),
  );
  if (!slot) return { ok: false, reason: 'invalid_slot' };
  if (!slot.available) {
    // Full — but the customer may still join the waitlist if the service allows.
    if (slot.waitlist) return { ok: false, reason: 'slot_full', waitlist: true, endAt: slot.endAt };
    return { ok: false, reason: 'slot_full' };
  }
  return { ok: true, endAt: slot.endAt };
}

export interface CreateBookingInput {
  companyId: string;
  serviceId?: string | null;
  customerId?: string | null;
  title: string;
  startAt: Date;
  endAt?: Date | null;
  notes?: string | null;
  status?: BookingStatus;
  source?: string; // recorded into customFields for provenance
}

/**
 * Capacity-safe booking creation. For a bookable service the capacity re-check
 * and the insert run in one transaction, so concurrent requests can't overbook a
 * slot. Ad-hoc bookings (no serviceId) are created directly.
 */
export async function createBooking(input: CreateBookingInput) {
  const { companyId, serviceId, customerId, title, startAt, notes, status } = input;

  const write = async (
    tx: Prisma.TransactionClient,
    endAt: Date | null,
    statusOverride?: BookingStatus,
  ) =>
    tx.booking.create({
      data: {
        companyId,
        ref: await nextRef(companyId, 'booking'),
        serviceId: serviceId ?? undefined,
        customerId: customerId ?? undefined,
        title,
        startAt,
        endAt: endAt ?? undefined,
        notes: notes ?? undefined,
        status: statusOverride ?? status ?? 'CONFIRMED',
        ...(input.source ? { customFields: { source: input.source } } : {}),
      },
      select: { id: true, ref: true, title: true, startAt: true, endAt: true, status: true },
    });

  if (!serviceId) {
    return db.$transaction((tx) => write(tx, input.endAt ?? null));
  }

  const svc = await getBookableService(companyId, serviceId);
  if (!svc) throw new BookingError('not_bookable');
  const endAt = input.endAt ?? new Date(startAt.getTime() + svc.durationMin * 60_000);

  return db.$transaction(async (tx) => {
    const taken = await tx.booking.count({
      where: { companyId, serviceId, status: { in: ACTIVE_STATUSES }, startAt },
    });
    if (taken >= svc.maxCapacity) {
      // Full → join the waitlist when the service opts in; WAITLIST doesn't hold
      // capacity, so it never blocks a real booking that frees up. Respect a
      // per-slot waitlist cap (0 = unlimited).
      if (svc.allowWaitlist) {
        if (svc.waitlistCapacity > 0) {
          const waiting = await tx.booking.count({
            where: { companyId, serviceId, status: 'WAITLIST', startAt },
          });
          if (waiting >= svc.waitlistCapacity) throw new BookingError('waitlist_full');
        }
        return write(tx, endAt, 'WAITLIST');
      }
      throw new BookingError('slot_full');
    }
    return write(tx, endAt);
  });
}

/**
 * When a slot frees up (a booking is cancelled or marked no-show), promote the
 * longest-waiting person off that slot's waitlist to CONFIRMED — by seniority
 * (oldest WAITLIST entry first). No-op if the slot is still full, the service
 * isn't bookable, or the waitlist is empty. Capacity-safe (single transaction).
 */
export async function promoteFromWaitlist(
  companyId: string,
  serviceId: string,
  startAt: Date,
): Promise<{ id: string; ref: string | null; customerId: string | null } | null> {
  const svc = await getBookableService(companyId, serviceId);
  if (!svc) return null;

  return db.$transaction(async (tx) => {
    const taken = await tx.booking.count({
      where: { companyId, serviceId, status: { in: ACTIVE_STATUSES }, startAt },
    });
    if (taken >= svc.maxCapacity) return null; // still full — nothing to promote into

    const next = await tx.booking.findFirst({
      where: { companyId, serviceId, status: 'WAITLIST', startAt },
      orderBy: { createdAt: 'asc' }, // priority + seniority: first in, first promoted
      select: { id: true, ref: true, customerId: true },
    });
    if (!next) return null;

    await tx.booking.update({ where: { id: next.id }, data: { status: 'CONFIRMED' } });
    return next;
  });
}
