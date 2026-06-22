'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Wallet, Plus, Coins, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { startWalletTopUp, buyTokenCredits } from '@/lib/actions/wallet';
import { formatSar, formatNumber, formatDateTime } from '@/lib/format';
import type { WalletTxView } from '@/lib/wallet';

const TOPUP_PRESETS = [50, 100, 300, 500];
const CREDIT_PRESETS = [1, 5, 10];

export function WalletClient({
  balance,
  transactions,
  pricePerMillion,
  tapConfigured,
}: {
  balance: number;
  currency: string;
  transactions: WalletTxView[];
  pricePerMillion: number;
  tapConfigured: boolean;
}) {
  const t = useTranslations('wallet');
  const locale = useLocale();
  const router = useRouter();

  const [amount, setAmount] = useState<number>(100);
  const [millions, setMillions] = useState<number>(5);
  const [toppingUp, startTopUp] = useTransition();
  const [buying, startBuy] = useTransition();

  const money = (n: number) => formatSar(n, locale);
  const creditCost = Math.max(0, Math.floor(millions)) * pricePerMillion;

  const onTopUp = () => {
    if (!tapConfigured) {
      toast.error(t('topUpUnavailable'));
      return;
    }
    startTopUp(async () => {
      const res = await startWalletTopUp(amount);
      if (res.ok) {
        window.location.href = res.url; // hand off to Tap's hosted page
      } else if (res.error === 'unconfigured') {
        toast.error(t('topUpUnavailable'));
      } else if (res.error === 'invalid') {
        toast.error(t('invalidAmount'));
      } else {
        toast.error(t('genericError'));
      }
    });
  };

  const onBuyCredits = () => {
    startBuy(async () => {
      const res = await buyTokenCredits(millions);
      if (res.ok) {
        toast.success(t('creditsAdded', { tokens: formatNumber(res.tokensAdded, locale) }));
        router.refresh();
      } else if (res.error === 'insufficient') {
        toast.error(t('insufficient'));
      } else {
        toast.error(t('genericError'));
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Balance + top-up */}
      <Card className="overflow-hidden">
        <div className="gradient-brand p-6 text-white">
          <div className="flex items-center gap-2 text-white/80">
            <Wallet className="size-4" />
            <span className="text-sm">{t('balance')}</span>
          </div>
          <p className="mt-2 text-4xl font-semibold tabular-nums">{money(balance)}</p>
        </div>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">{t('topUp')}</p>
          <div className="flex flex-wrap gap-2">
            {TOPUP_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(p)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  amount === p
                    ? 'border-primary bg-gradient-brand-soft text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {money(p)}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">{t('customAmount')}</label>
              <Input
                type="number"
                min={10}
                max={50000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                dir="ltr"
              />
            </div>
            <Button onClick={onTopUp} disabled={toppingUp || amount < 10}>
              <Plus className="me-1 size-4" />
              {toppingUp ? t('redirecting') : t('topUpCta')}
            </Button>
          </div>
          {!tapConfigured && (
            <p className="rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
              {t('topUpUnavailable')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Buy AI token credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="size-5 text-primary" />
            {t('buyCredits')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('creditsHelp', { price: money(pricePerMillion) })}
          </p>
          <div className="flex flex-wrap gap-2">
            {CREDIT_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMillions(m)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  millions === m
                    ? 'border-primary bg-gradient-brand-soft text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {t('millionTokens', { n: m })}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">{t('customMillions')}</label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={millions}
                onChange={(e) => setMillions(Number(e.target.value))}
                dir="ltr"
              />
            </div>
            <Button onClick={onBuyCredits} disabled={buying || millions < 1} variant="outline">
              {buying ? t('processing') : t('buyCta', { cost: money(creditCost) })}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">{t('history')}</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('noTransactions')}</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((tx) => {
                const credit = tx.type === 'TOPUP' || tx.type === 'REFUND';
                const pending = tx.status === 'PENDING';
                const failed = tx.status === 'FAILED';
                return (
                  <li key={tx.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                        failed
                          ? 'bg-destructive/10 text-destructive'
                          : credit
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {pending ? (
                        <Clock className="size-4" />
                      ) : credit ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {tx.description ?? t(`txType.${tx.type}`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(tx.createdAt, locale)}
                        {pending && ` · ${t('statusPending')}`}
                        {failed && ` · ${t('statusFailed')}`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        failed
                          ? 'text-muted-foreground line-through'
                          : credit
                            ? 'text-emerald-600'
                            : 'text-foreground'
                      }`}
                    >
                      {credit ? '+' : '−'}
                      {money(tx.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
