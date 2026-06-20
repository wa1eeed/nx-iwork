'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Phone, Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { StaggerList, MotionItem } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { feedback } from '@/lib/ui/feedback';
import { createCustomer, setCustomerStatus } from '@/lib/actions/customers';

export interface CustomerRow {
  id: string;
  ref: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  agentName: string | null;
}

// Pipeline status → badge classes. Labels are localized via the `crm.status.*`
// message keys (see STATUS_ORDER for the canonical order).
export const STATUS_CLS: Record<string, string> = {
  NEW: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  INTERESTED: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  NEGOTIATING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  WON: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  LOST: 'bg-muted text-muted-foreground',
};
export const STATUS_ORDER = ['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST'] as const;

const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

export function CustomerManager({ customers }: { customers: CustomerRow[] }) {
  const t = useTranslations('crm');
  const tc = useTranslations('common');
  const router = useRouter();
  const [filter, setFilter] = useState<string>('ALL');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, start] = useTransition();

  const shown = filter === 'ALL' ? customers : customers.filter((c) => c.status === filter);

  function add() {
    if (!name.trim()) return feedback('error', t('nameRequired'));
    start(async () => {
      const res = await createCustomer({ name: name.trim(), phone: phone.trim() || null, email: null, status: 'NEW', notes: null });
      if (res.ok) {
        feedback('success', t('added'));
        setName('');
        setPhone('');
        setAdding(false);
        router.refresh();
      } else {
        feedback('error', t('addFailed'));
      }
    });
  }

  function changeStatus(id: string, status: string) {
    start(async () => {
      const res = await setCustomerStatus(id, status as (typeof STATUS_ORDER)[number]);
      if (res.ok) {
        feedback(status === 'WON' ? 'success' : 'info', t('statusUpdated'));
        router.refresh();
      } else {
        feedback('error', t('updateFailed'));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={cn('rounded-full px-3 py-1 text-xs', filter === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
        >
          {t('all')} ({customers.length})
        </button>
        {STATUS_ORDER.map((s) => {
          const n = customers.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn('rounded-full px-3 py-1 text-xs', filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted')}
            >
              {t(`status.${s}`)} ({n})
            </button>
          );
        })}
        <div className="flex-1" />
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="me-1 h-4 w-4" />
            {t('newCustomer')}
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-5">
            <div className="flex-1 space-y-1">
              <Label>{t('name')} *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="flex-1 space-y-1">
              <Label>{t('phone')}</Label>
              <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9665..." />
            </div>
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>{tc('cancel')}</Button>
            <Button onClick={add} disabled={saving}>
              {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}{tc('save')}
            </Button>
          </CardContent>
        </Card>
      )}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <UserPlus className="h-8 w-8" />
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <StaggerList className="grid gap-2">
          {shown.map((c) => (
            <MotionItem key={c.id}>
              <Card className="transition hover:border-primary/50">
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <Link href={`/customers/${c.id}`} className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {c.ref && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {c.ref}
                        </span>
                      )}
                      {c.name}
                    </p>
                    <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {c.phone && (<span className="inline-flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" />{c.phone}</span>)}
                      {c.email && (<span className="inline-flex items-center gap-1" dir="ltr"><Mail className="h-3 w-3" />{c.email}</span>)}
                      {c.agentName && <span>· {c.agentName}</span>}
                    </p>
                  </Link>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_CLS[c.status])}>
                    {t(`status.${c.status}`)}
                  </span>
                  <select
                    className={selectCls}
                    value={c.status}
                    onChange={(e) => changeStatus(c.id, e.target.value)}
                    disabled={saving}
                    aria-label={t('statusAria')}
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>{t(`status.${s}`)}</option>
                    ))}
                  </select>
                </CardContent>
              </Card>
            </MotionItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
