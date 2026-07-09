import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ModulesManager } from '@/components/dashboard/modules-manager';

// The owner enables only the modules their business needs. This drives the
// sidebar, the visible pages, and which tools the agents receive.
export default async function ModulesPage() {
  const t = await getTranslations('pages.modules');
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
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
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
