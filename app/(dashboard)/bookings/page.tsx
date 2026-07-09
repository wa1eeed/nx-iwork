import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CalendarX, CalendarClock } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Card, CardContent } from '@/components/ui/card';
import { BookingsCalendar, type CalBooking } from '@/components/dashboard/bookings-calendar';

// Bookings module. Agents create bookings via the create_booking tool (routed
// through the deterministic engine); owners monitor + manage them here on a
// calendar with inline lifecycle actions.
export default async function BookingsPage() {
  const t = await getTranslations('pages.bookings');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { hasBookings: true },
  });
  // Module disabled → guide back to Modules.
  if (!company?.hasBookings) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CalendarX className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('moduleOff')}</p>
          <a href="/modules" className="text-sm text-primary underline">
            {t('enableFromModules')}
          </a>
        </CardContent>
      </Card>
    );
  }

  const [rows, staff] = await Promise.all([
    db.booking.findMany({
      where: { companyId },
      orderBy: { startAt: 'asc' },
      take: 500,
      select: {
        id: true,
        ref: true,
        title: true,
        startAt: true,
        status: true,
        staffMemberId: true,
        customer: { select: { name: true } },
      },
    }),
    db.staffMember.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  const bookings: CalBooking[] = rows.map((b) => ({
    id: b.id,
    ref: b.ref,
    title: b.title,
    startAt: b.startAt.toISOString(),
    status: b.status,
    customerName: b.customer?.name ?? null,
    staffMemberId: b.staffMemberId,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link href="/bookings/availability" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <CalendarClock className="h-4 w-4" />
          {t('manageAvailability')}
        </Link>
      </div>
      <BookingsCalendar bookings={bookings} staff={staff} />
    </div>
  );
}
