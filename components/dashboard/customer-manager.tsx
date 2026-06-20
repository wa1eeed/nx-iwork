'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  agentName: string | null;
}

export const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: 'جديد', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  INTERESTED: { label: 'مهتم', cls: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
  NEGOTIATING: { label: 'تفاوض', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  WON: { label: 'اشترى', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  LOST: { label: 'مفقود', cls: 'bg-muted text-muted-foreground' },
};
const ORDER = ['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST'] as const;
const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

export function CustomerManager({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('ALL');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, start] = useTransition();

  const shown = filter === 'ALL' ? customers : customers.filter((c) => c.status === filter);

  function add() {
    if (!name.trim()) return feedback('error', 'اسم العميل مطلوب.');
    start(async () => {
      const res = await createCustomer({ name: name.trim(), phone: phone.trim() || null, email: null, status: 'NEW', notes: null });
      if (res.ok) {
        feedback('success', 'تمت إضافة العميل.');
        setName('');
        setPhone('');
        setAdding(false);
        router.refresh();
      } else {
        feedback('error', 'تعذّرت الإضافة.');
      }
    });
  }

  function changeStatus(id: string, status: string) {
    start(async () => {
      const res = await setCustomerStatus(id, status as (typeof ORDER)[number]);
      if (res.ok) {
        feedback(status === 'WON' ? 'success' : 'info', 'تم تحديث حالة العميل.');
        router.refresh();
      } else {
        feedback('error', 'تعذّر التحديث.');
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
          الكل ({customers.length})
        </button>
        {ORDER.map((s) => {
          const n = customers.filter((c) => c.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn('rounded-full px-3 py-1 text-xs', filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted')}
            >
              {STATUS[s].label} ({n})
            </button>
          );
        })}
        <div className="flex-1" />
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="me-1 h-4 w-4" />
            عميل جديد
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 pt-5">
            <div className="flex-1 space-y-1">
              <Label>الاسم *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل" />
            </div>
            <div className="flex-1 space-y-1">
              <Label>الجوال</Label>
              <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9665..." />
            </div>
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>إلغاء</Button>
            <Button onClick={add} disabled={saving}>
              {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}حفظ
            </Button>
          </CardContent>
        </Card>
      )}

      {shown.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <UserPlus className="h-8 w-8" />
            لا عملاء في هذا التصنيف. وكلاؤك يسجّلونهم تلقائياً، أو أضِف يدوياً.
          </CardContent>
        </Card>
      ) : (
        <StaggerList className="grid gap-2">
          {shown.map((c) => (
            <MotionItem key={c.id}>
              <Card className="transition hover:border-primary/50">
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <Link href={`/customers/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {c.phone && (<span className="inline-flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3" />{c.phone}</span>)}
                      {c.email && (<span className="inline-flex items-center gap-1" dir="ltr"><Mail className="h-3 w-3" />{c.email}</span>)}
                      {c.agentName && <span>· {c.agentName}</span>}
                    </p>
                  </Link>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS[c.status]?.cls)}>
                    {STATUS[c.status]?.label ?? c.status}
                  </span>
                  <select
                    className={selectCls}
                    value={c.status}
                    onChange={(e) => changeStatus(c.id, e.target.value)}
                    disabled={saving}
                    aria-label="الحالة"
                  >
                    {ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS[s].label}</option>
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
