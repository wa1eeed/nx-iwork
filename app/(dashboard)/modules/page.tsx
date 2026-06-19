import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ModulesManager } from '@/components/dashboard/modules-manager';

// The owner enables only the modules their business needs. This drives the
// sidebar, the visible pages, and which tools the agents receive.
export default async function ModulesPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const company = companyId
    ? await db.company.findUnique({
        where: { id: companyId },
        select: { hasEcommerce: true, hasServices: true, hasBookings: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">الموديولات</h1>
        <p className="text-sm text-muted-foreground">
          فعّل ما يخدم نشاطك فقط — ستظهر أدواته في القائمة، وسيستخدمها وكلاؤك تلقائياً.
        </p>
      </div>

      <ModulesManager
        initial={{
          hasEcommerce: company?.hasEcommerce ?? true,
          hasServices: company?.hasServices ?? true,
          hasBookings: company?.hasBookings ?? false,
        }}
      />
    </div>
  );
}
