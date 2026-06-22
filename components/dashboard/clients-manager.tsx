'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Phone, Mail, ShoppingBag, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatSar, formatNumber } from '@/lib/format';
import { STATUS_CLS } from '@/components/dashboard/customer-manager';

export interface ClientRow {
  id: string;
  ref: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export function ClientsManager({ clients }: { clients: ClientRow[] }) {
  const t = useTranslations('clients');
  const tc = useTranslations('crm');
  const locale = useLocale();
  const [q, setQ] = useState('');

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? clients.filter((c) =>
        `${c.name} ${c.phone ?? ''} ${c.ref ?? ''} ${c.email ?? ''}`.toLowerCase().includes(needle)
      )
    : clients;

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
          <UserCheck className="h-8 w-8" />
          {t('empty')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="ps-9" />
      </div>

      <div className="grid gap-2">
        {filtered.map((c) => (
          <Link key={c.id} href={`/customers/${c.id}`}>
            <Card className="transition hover:border-primary/50">
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand-soft text-sm font-semibold text-primary">
                  {Array.from(c.name)[0] ?? '?'}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {c.ref && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                        {c.ref}
                      </span>
                    )}
                    {c.name}
                  </p>
                  <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.phone && (
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex items-center gap-1" dir="ltr">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-end">
                  <div>
                    <p className="inline-flex items-center gap-1 text-sm font-medium tabular-nums">
                      <ShoppingBag className="size-3.5 text-muted-foreground" />
                      {formatNumber(c.ordersCount, locale)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{t('ordersLabel')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums">{formatSar(c.totalSpent, locale)}</p>
                    <p className="text-[11px] text-muted-foreground">{t('spent')}</p>
                  </div>
                </div>

                <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_CLS[c.status])}>
                  {tc(`status.${c.status}`)}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('noMatch')}</p>
      )}
    </div>
  );
}
