'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Check, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceIcon } from '@/components/dashboard/service-icon';
import { buyService } from '@/lib/actions/marketplace';
import { formatSar } from '@/lib/format';
import type { MarketplaceServiceView } from '@/lib/marketplace';

export function ServicesClient({
  services,
  ownedIds,
  balance,
}: {
  services: MarketplaceServiceView[];
  ownedIds: string[];
  balance: number;
}) {
  const t = useTranslations('services');
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const owned = new Set(ownedIds);
  const money = (n: number) => formatSar(n, locale);

  const onBuy = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      const res = await buyService(id);
      setPendingId(null);
      if (res.ok) {
        toast.success(t('purchased'));
        router.refresh();
      } else if (res.error === 'insufficient') {
        toast.error(t('insufficient'));
      } else {
        toast.error(t('genericError'));
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" />
          {t('walletBalance')}
        </span>
        <span className="flex items-center gap-3">
          <span className="font-semibold tabular-nums">{money(balance)}</span>
          <Link href="/wallet" className="text-sm text-primary hover:underline">
            {t('topUp')}
          </Link>
        </span>
      </div>

      {services.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const isOwned = owned.has(s.id);
            const isPending = pendingId === s.id;
            const tooPoor = s.price > 0 && balance < s.price;
            return (
              <Card key={s.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 pt-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-brand-soft text-primary">
                    <ServiceIcon name={s.icon} className="size-5" />
                  </span>
                  <div className="flex-1">
                    {s.category && (
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {s.category}
                      </p>
                    )}
                    <h3 className="font-semibold">{s.title}</h3>
                    {s.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-lg font-semibold">
                      {s.price === 0 ? t('free') : money(s.price)}
                    </span>
                    {isOwned ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                        <Check className="size-4" />
                        {t('owned')}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onBuy(s.id)}
                        disabled={isPending || tooPoor}
                        variant={tooPoor ? 'outline' : 'default'}
                      >
                        {isPending ? t('processing') : tooPoor ? t('topUpFirst') : t('buy')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
