import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { DepartmentManager } from '@/components/dashboard/department-manager';

export default async function DepartmentsPage() {
  const t = await getTranslations('pages.departments');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const departments = companyId
    ? await db.department.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          nameEn: true,
          icon: true,
          color: true,
          description: true,
          landingVisible: true,
          tagline: true,
          _count: { select: { agents: true, services: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <DepartmentManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          nameEn: d.nameEn,
          icon: d.icon,
          color: d.color,
          description: d.description,
          landingVisible: d.landingVisible,
          tagline: d.tagline,
          serviceCount: d._count.services,
          agentCount: d._count.agents,
        }))}
      />
    </div>
  );
}
