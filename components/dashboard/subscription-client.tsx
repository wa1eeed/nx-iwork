'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check, Wallet, CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatSar, formatDate } from '@/lib/format';
import { subscribeWithWallet, startSubscriptionTapCheckout } from '@/lib/actions/subscription';
import type { SubscriptionView, PlanView } from '@/lib/billing/subscription';

export function SubscriptionClient({
  view,
  tapConfigured,
}: {
  view: SubscriptionView;
  tapConfigured: boolean;
}) {
  const t = useTranslations('subscription');
  const tf = useTranslations('onboarding.plans.features');
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<PlanView | null>(null);
  const [pending, start] = useTransition();

  const money = (n: number) => formatSar(n, locale);
  const currentName =
    view.plans.find((p) => p.tier === view.currentTier)?.name ?? t(`tierName.${view.currentTier}`);

  const payWallet = (tier: string) =>
    start(async () => {
      const res = await subscribeWithWallet(tier);
      if (res.ok) {
        toast.success(t('activated'));
        setSelected(null);
        router.refresh();
      } else if (res.error === 'insufficient') {
        toast.error(t('insufficient'));
      } else {
        toast.error(t('genericError'));
      }
    });

  const payTap = (tier: string) =>
    start(async () => {
      const res = await startSubscriptionTapCheckout(tier);
      if (res.ok) {
        window.location.href = res.url;
      } else if (res.error === 'unconfigured') {
        toast.error(t('tapUnavailable'));
      } else if (res.error === 'free') {
        payWallet(tier);
      } else {
        toast.error(t('genericError'));
      }
    });

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 gradient-brand p-6 text-white">
          <div>
            <p className="text-sm text-white/80">{t('currentPlan')}</p>
            <p className="text-2xl font-semibold">{currentName}</p>
            <p className="mt-1 text-xs text-white/80">
              {t(`status.${view.status}`)}
              {view.currentPeriodEnd
                ? ` · ${t('renewsOn', { date: formatDate(view.currentPeriodEnd, locale) })}`
                : ''}
            </p>
          </div>
          <div className="text-end">
            <p className="text-xs text-white/80">{t('walletBalance')}</p>
            <p className="text-lg font-semibold tabular-nums">{money(view.walletBalance)}</p>
          </div>
        </div>
      </Card>

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {view.plans.map((p) => {
          const isCurrent = p.tier === view.currentTier;
          return (
            <Card key={p.tier} className={p.recommended ? 'ring-2 ring-primary' : ''}>
              <CardContent className="flex h-full flex-col gap-3 pt-6">
                {p.recommended && (
                  <span className="self-start rounded-full bg-gradient-brand px-2.5 py-0.5 text-[11px] font-medium text-white">
                    {t('recommended')}
                  </span>
                )}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p>
                  <span className="text-2xl font-semibold">
                    {p.priceMonthly === 0 ? t('free') : money(p.priceMonthly)}
                  </span>
                  {p.priceMonthly > 0 && (
                    <span className="text-sm text-muted-foreground"> /{t('month')}</span>
                  )}
                </p>
                <ul className="flex-1 space-y-1.5 text-sm text-muted-foreground">
                  {p.featureKeys.map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      {tf(k)}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">
                    {t('current')}
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => setSelected(p)}>
                    {p.priceMonthly === 0 ? t('choose') : t('upgrade')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Invoices */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 font-semibold">{t('invoices')}</h3>
          {view.invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noInvoices')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {view.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="font-medium">{inv.number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.createdAt, locale)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {t(`invoiceStatus.${inv.status}`)}
                    </span>
                    <span className="font-semibold tabular-nums">{money(inv.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Payment method modal */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !pending && setSelected(null)}
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="glass relative w-full max-w-sm rounded-2xl border p-5 shadow-elevated"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">{t('choosePayment')}</h3>
                <button
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-sm">
                <span className="text-muted-foreground">{selected.name}</span>
                <span className="font-semibold">
                  {selected.priceMonthly === 0
                    ? t('free')
                    : `${money(selected.priceMonthly)} /${t('month')}`}
                </span>
              </div>

              <div className="space-y-2">
                {/* Pay from wallet — current balance shown alongside */}
                <button
                  disabled={
                    pending ||
                    (selected.priceMonthly > 0 && view.walletBalance < selected.priceMonthly)
                  }
                  onClick={() => payWallet(selected.tier)}
                  className="flex w-full items-center justify-between rounded-xl border p-3 text-start transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Wallet className="size-4 text-primary" />
                    {t('payWallet')}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {money(view.walletBalance)}
                  </span>
                </button>
                {selected.priceMonthly > 0 && view.walletBalance < selected.priceMonthly && (
                  <p className="text-xs text-destructive">{t('insufficientShort')}</p>
                )}

                {/* Pay directly via Tap (card / Apple Pay) */}
                {selected.priceMonthly > 0 && (
                  <button
                    disabled={pending || !tapConfigured}
                    onClick={() => payTap(selected.tier)}
                    className="flex w-full items-center justify-between rounded-xl border p-3 text-start transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <CreditCard className="size-4 text-primary" />
                      {t('payCard')}
                    </span>
                    <span className="text-xs text-muted-foreground">{t('cardApplePay')}</span>
                  </button>
                )}
                {selected.priceMonthly > 0 && !tapConfigured && (
                  <p className="text-xs text-muted-foreground">{t('tapUnavailable')}</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
