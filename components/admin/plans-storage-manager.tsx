'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Database, HardDrive } from 'lucide-react';
import type { PlanTier } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { feedback } from '@/lib/ui/feedback';
import { formatBytes } from '@/lib/format';
import { setPlanStorage } from '@/lib/actions/admin';

interface PlanRow {
  tier: PlanTier;
  name: string;
  gb: number;
}
interface Consumer {
  id: string;
  name: string;
  used: number;
  limit: number;
  percent: number;
}

export function PlansStorageManager({
  plans,
  totalUsed,
  consumers,
}: {
  plans: PlanRow[];
  totalUsed: number;
  consumers: Consumer[];
}) {
  const t = useTranslations('admin.plans');
  const locale = useLocale();
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(plans.map((p) => [p.tier, String(p.gb)]))
  );
  const [pending, start] = useTransition();

  const save = (tier: PlanTier) =>
    start(async () => {
      const gb = Number(vals[tier]);
      const res = await setPlanStorage(tier, gb);
      feedback(res.ok ? 'success' : 'error', res.ok ? t('saved') : t('saveError'));
    });

  return (
    <div className="space-y-6">
      {/* Per-plan storage ceilings */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="flex items-center gap-2 font-medium">
            <HardDrive className="size-4 text-primary" />
            {t('planCeilings')}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => (
              <div key={p.tier} className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">{p.name}</p>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    value={vals[p.tier]}
                    onChange={(e) => setVals((v) => ({ ...v, [p.tier]: e.target.value }))}
                    dir="ltr"
                    className="h-9"
                  />
                  <span className="text-sm text-muted-foreground">GB</span>
                </div>
                <Button size="sm" className="w-full" onClick={() => save(p.tier)} disabled={pending}>
                  {t('save')}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('ceilingHelp')}</p>
        </CardContent>
      </Card>

      {/* Ecosystem telemetry */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-medium">
              <Database className="size-4 text-primary" />
              {t('usage')}
            </p>
            <span className="text-sm text-muted-foreground">
              {t('totalUsed')}:{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {formatBytes(totalUsed, locale)}
              </span>
            </span>
          </div>
          {consumers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('noUsage')}</p>
          ) : (
            <ul className="space-y-2.5">
              {consumers.map((c) => (
                <li key={c.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span
                      className={cn(
                        'shrink-0 tabular-nums',
                        c.percent >= 90 ? 'font-semibold text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {formatBytes(c.used, locale)} / {formatBytes(c.limit, locale)} · {c.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        c.percent >= 90 ? 'bg-destructive' : 'bg-gradient-brand'
                      )}
                      style={{ width: `${c.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
