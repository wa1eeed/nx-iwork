import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import { listActiveServices, purchasedServiceIds } from '@/lib/marketplace';
import { getOrCreateWallet } from '@/lib/wallet';
import { ServicesClient } from '@/components/dashboard/services-client';

// Platform add-ons marketplace (extra storage, token credits, …) — distinct from
// the tenant's own customer-facing catalog services (/services).
export default async function MarketplacePage() {
  const t = await getTranslations('services');
  const locale = await getLocale();
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  if (!companyId) {
    return <div className="p-6 text-sm text-muted-foreground">{t('unavailable')}</div>;
  }

  const [services, owned, wallet] = await Promise.all([
    listActiveServices(locale),
    purchasedServiceIds(companyId),
    getOrCreateWallet(companyId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ServicesClient services={services} ownedIds={owned} balance={wallet.balance.toNumber()} />
    </div>
  );
}
