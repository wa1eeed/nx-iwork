'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Loader2, Phone, Mail, LayoutGrid, List, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

// Pipeline stage → badge classes. Labels localized via `crm.status.*`.
export const STATUS_CLS: Record<string, string> = {
  NEW: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  INTERESTED: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  NEGOTIATING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  DEFERRED: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
  WON: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  LOST: 'bg-muted text-muted-foreground',
};
export const STATUS_ORDER = ['NEW', 'INTERESTED', 'NEGOTIATING', 'DEFERRED', 'WON', 'LOST'] as const;

const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

export function CustomerManager({ customers }: { customers: CustomerRow[] }) {
  const t = useTranslations('crm');
  const tc = useTranslations('common');
  const router = useRouter();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [filter, setFilter] = useState<string>('ALL');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);

  const shown = filter === 'ALL' ? customers : customers.filter((c) => c.status === filter);

  function add() {
    if (!name.trim()) return feedback('error', t('nameRequired'));
    start(async () => {
      const res = await createCustomer({
        name: name.trim(),
        phone: phone.trim() || null,
        email: null,
        status: 'NEW',
        notes: null,
      });
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

  function drop(status: string) {
    if (dragId) {
      const cur = customers.find((c) => c.id === dragId);
      if (cur && cur.status !== status) changeStatus(dragId, status);
    }
    setDragId(null);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: view toggle + add */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <button
            onClick={() => setView('board')}
            className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium', view === 'board' ? 'bg-gradient-brand-soft text-primary' : 'text-muted-foreground')}
          >
            <LayoutGrid className="size-3.5" />
            {t('viewBoard')}
          </button>
          <button
            onClick={() => setView('list')}
            className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium', view === 'list' ? 'bg-gradient-brand-soft text-primary' : 'text-muted-foreground')}
          >
            <List className="size-3.5" />
            {t('viewList')}
          </button>
        </div>
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
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button onClick={add} disabled={saving}>
              {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </CardContent>
        </Card>
      )}

      {customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <UserPlus className="h-8 w-8" />
            {t('empty')}
          </CardContent>
        </Card>
      ) : view === 'board' ? (
        /* ── Kanban board ── */
        <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
          {STATUS_ORDER.map((s) => {
            const col = customers.filter((c) => c.status === s);
            return (
              <div
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(s)}
                className="flex w-64 shrink-0 flex-col rounded-xl border bg-muted/20"
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLS[s])}>
                    {t(`status.${s}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">{col.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {col.map((c) => (
                    <Link
                      key={c.id}
                      href={`/customers/${c.id}`}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        'cursor-grab rounded-lg border bg-background p-2.5 shadow-card transition active:cursor-grabbing hover:border-primary/50',
                        dragId === c.id && 'opacity-50'
                      )}
                    >
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {c.ref && (
                          <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                            {c.ref}
                          </span>
                        )}
                        {c.name}
                      </p>
                      {c.phone && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </p>
                      )}
                      {c.agentName && <p className="text-[11px] text-muted-foreground">· {c.agentName}</p>}
                    </Link>
                  ))}
                  {col.length === 0 && (
                    <p className="py-6 text-center text-[11px] text-muted-foreground/60">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List view ── */
        <div className="space-y-3">
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
          </div>
          <div className="grid gap-2">
            {shown.map((c) => (
              <Card key={c.id} className="transition hover:border-primary/50">
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
                      <option key={s} value={s}>
                        {t(`status.${s}`)}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
