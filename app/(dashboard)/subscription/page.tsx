import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import {
  getSubscriptionView,
  settleSubscriptionPayment,
  cardFromCharge,
  isSelectableTier,
} from '@/lib/billing/subscription';
import { retrieveCharge, isCaptured, isTapConfigured } from '@/lib/payments/tap';
import { SubscriptionClient } from '@/components/dashboard/subscription-client';

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ tap_id?: string; sub?: string }>;
}) {
  const t = await getTranslations('subscription');
  const locale = await getLocale();
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  if (!companyId) {
    return <div className="p-6 text-sm text-muted-foreground">{t('unavailable')}</div>;
  }

  // Reconcile a return from Tap (belt-and-braces with the webhook).
  const sp = await searchParams;
  let banner: 'success' | 'failed' | null = null;
  if (sp.tap_id) {
    const charge = await retrieveCharge(sp.tap_id);
    if (charge && isCaptured(charge) && String(charge.metadata?.kind) === 'subscription') {
      const cid = String(charge.metadata?.companyId ?? '');
      const tier = String(charge.metadata?.tier ?? '');
      if (cid && isSelectableTier(tier)) {
        await settleSubscriptionPayment(cid, tier, charge.id, cardFromCharge(charge));
        banner = 'success';
      }
    } else if (sp.sub === 'return') {
      banner = 'failed';
    }
  }

  const view = await getSubscriptionView(companyId, locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {banner === 'success' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {t('paySuccess')}
        </div>
      )}
      {banner === 'failed' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {t('payFailed')}
        </div>
      )}

      <SubscriptionClient view={view} tapConfigured={isTapConfigured()} />
    </div>
  );
}
