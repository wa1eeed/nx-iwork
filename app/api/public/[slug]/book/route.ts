import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nextRef } from '@/lib/refs';
import { createBooking, checkSlotAvailable, BookingError } from '@/lib/booking/engine';
import { sendBookingConfirmation } from '@/lib/notifications/booking-emails';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Per-visitor/IP rate limit (single-instance MVP guard), mirroring the order route.
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 8;
}

// A visitor books a slot from the public page. The slot + capacity are validated
// by the deterministic engine (createBooking runs the capacity check inside a
// transaction), so this route is a thin, safe wrapper — no booking logic here.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const serviceId = typeof body.serviceId === 'string' ? body.serviceId : '';
  const startAtISO = typeof body.startAt === 'string' ? body.startAt : '';
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  const rawEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
  const customerEmail = EMAIL_RE.test(rawEmail) ? rawEmail : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : null;
  const startAt = new Date(startAtISO);
  if (!serviceId || !customerName || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(`${slug}:${ip}`)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const company = await db.company.findUnique({
    where: { slug },
    select: {
      id: true,
      status: true,
      settings: { select: { primaryLanguage: true } },
    },
  });
  if (!company || company.status === 'SUSPENDED') {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 404 });
  }

  const svc = await db.service.findFirst({
    where: { id: serviceId, companyId: company.id, isActive: true },
    select: { title: true },
  });
  if (!svc) return NextResponse.json({ ok: false, reason: 'item' }, { status: 404 });

  // Fast pre-check for a friendly message (createBooking re-checks atomically).
  // A full-but-waitlistable slot is allowed through — the engine creates a
  // WAITLIST booking that doesn't hold capacity.
  const pre = await checkSlotAvailable(company.id, serviceId, startAtISO);
  if (!pre.ok && !pre.waitlist) {
    return NextResponse.json({ ok: false, reason: pre.reason ?? 'unavailable' }, { status: 409 });
  }

  // Find-or-create the CRM customer (by phone within the company).
  let customerId: string | undefined;
  if (customerPhone) {
    const existing = await db.customer.findFirst({
      where: { companyId: company.id, phone: customerPhone },
      select: { id: true },
    });
    customerId =
      existing?.id ??
      (await db.customer.create({
        data: {
          companyId: company.id,
          ref: await nextRef(company.id, 'customer'),
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          status: 'INTERESTED',
          source: 'public_booking',
        },
        select: { id: true },
      })).id;
  }

  let booking;
  try {
    booking = await createBooking({
      companyId: company.id,
      serviceId,
      customerId,
      title: svc.title,
      startAt,
      notes,
      status: 'PENDING',
      source: 'public_booking',
    });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ ok: false, reason: err.code }, { status: 409 });
    }
    throw err;
  }

  const waitlisted = booking.status === 'WAITLIST';

  // Confirmation to the customer — tenant-branded, localized, owner-gated.
  // Fire-and-forget: a mail failure must never fail the booking.
  if (customerEmail) {
    void sendBookingConfirmation(company.id, {
      to: customerEmail,
      customerName,
      serviceTitle: svc.title,
      startAt: booking.startAt,
      ref: booking.ref,
      waitlisted,
    }).catch((e) => console.error('[book] confirmation email failed:', e));
  }

  return NextResponse.json({
    ok: true,
    waitlist: waitlisted,
    ref: booking.ref,
    startAt: booking.startAt.toISOString(),
    title: svc.title,
  });
}
