'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ShoppingBag, Trash2, Loader2, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StaggerList, MotionItem } from '@/components/ui/motion';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { feedback } from '@/lib/ui/feedback';
import { setOrderStatus, deleteOrder, setOrderStaff } from '@/lib/actions/orders';

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerId: string | null;
  total: string;
  type: string;
  status: string;
  staffMemberId: string | null;
  createdAt: string;
}

export interface StaffOption {
  id: string;
  name: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: 'جديد', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  CONFIRMED: { label: 'مؤكّد', cls: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
  IN_PROGRESS: { label: 'قيد التنفيذ', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  COMPLETED: { label: 'مكتمل', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  CANCELLED: { label: 'ملغى', cls: 'bg-muted text-muted-foreground' },
};
const ORDER = ['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const selectCls = 'h-8 rounded-md border border-input bg-background px-2 text-xs';

function fmt(iso: string): string {
  return formatDateTime(iso, 'ar', { dateStyle: 'medium', timeStyle: 'short' });
}

export function OrderManager({ orders, staff }: { orders: OrderRow[]; staff: StaffOption[] }) {
  const t = useTranslations('agentControls.order');
  const router = useRouter();
  const [filter, setFilter] = useState('ALL');
  const [pending, start] = useTransition();

  function changeStaff(id: string, staffMemberId: string) {
    start(async () => {
      const res = await setOrderStaff(id, staffMemberId || null);
      if (res.ok) {
        feedback('info', t('attributionUpdated'));
        router.refresh();
      } else feedback('error', t('attributionError'));
    });
  }

  const shown = filter === 'ALL' ? orders : orders.filter((o) => o.status === filter);

  function change(id: string, status: string) {
    start(async () => {
      const res = await setOrderStatus(id, status as (typeof ORDER)[number]);
      if (res.ok) {
        feedback(status === 'COMPLETED' ? 'success' : 'info', 'تم تحديث حالة الطلب.');
        router.refresh();
      } else feedback('error', 'تعذّر التحديث.');
    });
  }

  function remove(id: string) {
    if (!window.confirm('حذف هذا الطلب؟')) return;
    start(async () => {
      const res = await deleteOrder(id);
      if (res.ok) {
        feedback('success', 'تم الحذف.');
        router.refresh();
      } else feedback('error', 'تعذّر الحذف.');
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('ALL')} className={cn('rounded-full px-3 py-1 text-xs', filter === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          الكل ({orders.length})
        </button>
        {ORDER.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn('rounded-full px-3 py-1 text-xs', filter === s ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
            {STATUS[s].label} ({orders.filter((o) => o.status === s).length})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <ShoppingBag className="h-8 w-8" />
            لا طلبات. الطلبات الواردة من صفحتك العامة تظهر هنا تلقائياً.
          </CardContent>
        </Card>
      ) : (
        <StaggerList className="grid gap-2">
          {shown.map((o) => (
            <MotionItem key={o.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <Link href={`/orders/${o.id}`} className="hover:underline">#{o.orderNumber}</Link>{' '}
                      <span className="text-sm font-normal text-muted-foreground">· {o.total} ر.س</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {o.customerId ? (
                        <Link href={`/customers/${o.customerId}`} className="hover:underline">{o.customerName}</Link>
                      ) : (
                        o.customerName
                      )}{' '}
                      · {fmt(o.createdAt)}
                    </p>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS[o.status]?.cls)}>
                    {STATUS[o.status]?.label ?? o.status}
                  </span>
                  {staff.length > 0 && (
                    <select
                      className={selectCls}
                      value={o.staffMemberId ?? ''}
                      onChange={(e) => changeStaff(o.id, e.target.value)}
                      disabled={pending}
                      aria-label="Staff"
                      title="Attribute to staff (commissions)"
                    >
                      <option value="">{t('unassigned')}</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select className={selectCls} value={o.status} onChange={(e) => change(o.id, e.target.value)} disabled={pending} aria-label="الحالة">
                    {ORDER.map((s) => (
                      <option key={s} value={s}>{STATUS[s].label}</option>
                    ))}
                  </select>
                  <Link
                    href={`/orders/${o.id}`}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="التفاصيل"
                  >
                    <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => remove(o.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </MotionItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
