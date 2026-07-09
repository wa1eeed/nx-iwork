import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { getWalletSummary, completeTopUp } from '@/lib/wallet';
import { retrieveCharge, isTapConfigured, isCaptured } from '@/lib/payments/tap';
import { WalletClient } from '@/components/dashboard/wallet-client';

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ tap_id?: string; topup?: string }>;
}) {
  const t = await getTranslations('wallet');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  if (!companyId) {
    return <div className="p-6 text-sm text-muted-foreground">{t('unavailable')}</div>;
  }

  // Reconcile a return from Tap's hosted page — belt-and-braces with the webhook
  // so the balance settles even if the webhook is delayed or unreachable.
  const sp = await searchParams;
  let banner: 'success' | 'failed' | null = null;
  if (sp.tap_id) {
    const charge = await retrieveCharge(sp.tap_id);
    if (charge && isCaptured(charge)) {
      await completeTopUp(charge.id);
      banner = 'success';
    } else if (sp.topup === 'return') {
      banner = 'failed';
    }
  }

  const [summary, settings, company] = await Promise.all([
    getWalletSummary(companyId),
    db.platformSettings.findUnique({
      where: { id: 'singleton' },
      select: { tokenPricePerMillion: true },
    }),
    db.company.findUnique({ where: { id: companyId }, select: { tokenBalance: true } }),
  ]);
  const pricePerMillion = settings ? settings.tokenPricePerMillion.toNumber() : 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {banner === 'success' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {t('topUpSuccess')}
        </div>
      )}
      {banner === 'failed' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {t('topUpFailed')}
        </div>
      )}

      <WalletClient
        balance={summary.balance}
        currency={summary.currency}
        transactions={summary.transactions}
        pricePerMillion={pricePerMillion}
        tokenBalance={company?.tokenBalance ?? 0}
        tapConfigured={isTapConfigured()}
      />
    </div>
  );
}
