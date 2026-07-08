import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { AvailabilityEditor, type ServiceAvail } from '@/components/dashboard/availability-editor';

// Per-service booking config + weekly availability — the entry point that makes a
// catalog service bookable by the deterministic engine (there is no separate
// catalog-service editor; services are seeded at onboarding).
export default async function AvailabilityPage() {
  const t = await getTranslations('pages.availability');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { hasBookings: true },
  });
  if (!company?.hasBookings) redirect('/bookings');

  const rows = await db.service.findMany({
    where: { companyId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      title: true,
      durationMin: true,
      bufferMin: true,
      maxCapacity: true,
      availability: {
        select: { dayOfWeek: true, startTime: true, endTime: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      },
    },
  });
  const services: ServiceAvail[] = rows.map((s) => ({
    id: s.id,
    title: s.title,
    durationMin: s.durationMin,
    bufferMin: s.bufferMin,
    maxCapacity: s.maxCapacity,
    windows: s.availability,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bookings" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {t('back')}
        </Link>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <AvailabilityEditor services={services} />
    </div>
  );
}
