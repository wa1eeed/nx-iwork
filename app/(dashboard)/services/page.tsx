import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Store, ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import {
  ServiceCatalogManager,
  type CatalogServiceRow,
  type DeptOption,
} from '@/components/dashboard/service-catalog-manager';

// The tenant's own customer-facing catalog services (bookable), grouped under
// clinics/departments and shown on the public landing page. (Platform add-ons
// live at /marketplace.)
export default async function ServicesPage() {
  const t = await getTranslations('pageHeaders');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const [services, departments] = await Promise.all([
    db.service.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        subtitle: true,
        description: true,
        price: true,
        priceLabel: true,
        durationMin: true,
        allowWaitlist: true,
        waitlistCapacity: true,
        departmentId: true,
        image: true,
        isActive: true,
      },
    }),
    db.department.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const rows: CatalogServiceRow[] = services.map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    description: s.description,
    price: s.price != null ? Number(s.price) : null,
    priceLabel: s.priceLabel,
    durationMin: s.durationMin,
    allowWaitlist: s.allowWaitlist,
    waitlistCapacity: s.waitlistCapacity,
    departmentId: s.departmentId,
    image: s.image,
    isActive: s.isActive,
  }));
  const depts: DeptOption[] = departments;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('services.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('services.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/bookings/availability"
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
          >
            {t('services.availability')} <ArrowRight className="size-3.5 rtl:rotate-180" />
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent"
          >
            <Store className="size-4" /> {t('services.addons')}
          </Link>
        </div>
      </div>
      <ServiceCatalogManager services={rows} departments={depts} />
    </div>
  );
}
