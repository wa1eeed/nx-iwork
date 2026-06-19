import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { DepartmentManager } from '@/components/dashboard/department-manager';

export default async function DepartmentsPage() {
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
          _count: { select: { agents: true } },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">الأقسام</h1>
        <p className="text-sm text-muted-foreground">
          نظّم شركتك في أقسام، ثم عيّن موظفي الذكاء الاصطناعي في كل قسم.
        </p>
      </div>

      <DepartmentManager
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          nameEn: d.nameEn,
          icon: d.icon,
          color: d.color,
          description: d.description,
          agentCount: d._count.agents,
        }))}
      />
    </div>
  );
}
