import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { StaffManager, type StaffRow } from '@/components/dashboard/staff-manager';

export default async function StaffPage() {
  const t = await getTranslations('pageHeaders');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const staff = await db.staffMember.findMany({
    where: { companyId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  const rows: StaffRow[] = staff.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    bio: s.bio,
    image: s.image,
    phone: s.phone,
    email: s.email,
    commissionType: s.commissionType,
    commissionRate: Number(s.commissionRate),
    monthlyTarget: s.monthlyTarget != null ? Number(s.monthlyTarget) : null,
    isActive: s.isActive,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('staff.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('staff.subtitle')}
          </p>
        </div>
        <Link
          href="/commissions"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
        >
          {t('staff.viewCommissions')} <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>
      <StaffManager staff={rows} />
    </div>
  );
}
