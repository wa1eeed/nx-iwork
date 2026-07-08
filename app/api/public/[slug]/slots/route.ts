import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateDaySlots } from '@/lib/booking/engine';

export const dynamic = 'force-dynamic';

// Public: available booking slots for a service on a given day (business-local
// `YYYY-MM-DD`). Read-only; returns only still-open slots. The deterministic
// engine is the single source of truth.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const serviceId = url.searchParams.get('serviceId') ?? '';
  const date = url.searchParams.get('date') ?? ''; // YYYY-MM-DD
  if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!company || company.status === 'SUSPENDED') {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 404 });
  }

  const slots = await generateDaySlots(company.id, serviceId, date);
  return NextResponse.json({
    ok: true,
    slots: slots
      .filter((s) => s.available)
      .map((s) => ({ startAt: s.startAt, label: s.label, remaining: s.remaining })),
  });
}
