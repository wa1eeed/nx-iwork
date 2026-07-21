import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Contact,
  CalendarCheck,
  CircleDollarSign,
  ShoppingBag,
  Bot,
  Package2,
} from 'lucide-react';
import { db } from '@/lib/db';

function sar(n: number) {
  return `${Math.round(n).toLocaleString('en')} SAR`;
}
const num = (n: number) => n.toLocaleString('en');

// A whole-business 360° snapshot for the Command Center: customers, bookings,
// revenue, orders, workforce, and inventory — each with a quick breakdown.
// Self-contained (its own tenant-scoped queries) so it composes anywhere.
export async function BusinessCounters({ companyId }: { companyId: string }) {
  const t = await getTranslations('biz.counters');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    custTotal,
    custByStatus,
    bookByStatus,
    bookUpcoming,
    monthRevenue,
    orderTotal,
    ordersByStatus,
    agentsOnline,
    pendingApprovals,
    inventory,
  ] = await Promise.all([
    db.customer.count({ where: { companyId } }),
    db.customer.groupBy({ by: ['status'], where: { companyId }, _count: true }),
    db.booking.groupBy({ by: ['status'], where: { companyId }, _count: true }),
    db.booking.count({ where: { companyId, status: 'CONFIRMED', startAt: { gte: now } } }),
    db.order.aggregate({
      where: { companyId, status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
    db.order.count({ where: { companyId, status: { not: 'CANCELLED' } } }),
    db.order.groupBy({ by: ['status'], where: { companyId }, _count: true }),
    db.agent.count({ where: { companyId, status: { in: ['ONLINE', 'WORKING'] } } }),
    db.approval.count({ where: { companyId, status: 'PENDING' } }),
    db.inventoryItem.findMany({
      where: { companyId, isActive: true },
      select: { quantityOnHand: true, reorderLevel: true },
    }),
  ]);

  const cBy = new Map(custByStatus.map((r) => [r.status, r._count]));
  const bBy = new Map(bookByStatus.map((r) => [r.status, r._count]));
  const oBy = new Map(ordersByStatus.map((r) => [r.status, r._count]));
  const lowStock = inventory.filter((i) => Number(i.quantityOnHand) <= Number(i.reorderLevel)).length;

  const chip = (label: string, n: number) =>
    n > 0 ? (
      <span key={label} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
        {label} {num(n)}
      </span>
    ) : null;

  const CARDS = [
    {
      href: '/customers',
      icon: Contact,
      tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      label: t('customers'),
      value: num(custTotal),
      breakdown: [
        chip(t('won'), cBy.get('WON') ?? 0),
        chip(t('negotiating'), cBy.get('NEGOTIATING') ?? 0),
        chip(t('interested'), cBy.get('INTERESTED') ?? 0),
        chip(t('new'), cBy.get('NEW') ?? 0),
      ],
    },
    {
      href: '/bookings',
      icon: CalendarCheck,
      tint: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      label: t('bookingsUpcoming'),
      value: num(bookUpcoming),
      breakdown: [
        chip(t('confirmed'), bBy.get('CONFIRMED') ?? 0),
        chip(t('completed'), bBy.get('COMPLETED') ?? 0),
        chip(t('cancelled'), bBy.get('CANCELLED') ?? 0),
      ],
    },
    {
      href: '/sales',
      icon: CircleDollarSign,
      tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      label: t('revenueMonth'),
      value: sar(Number(monthRevenue._sum.total ?? 0)),
      breakdown: [],
    },
    {
      href: '/orders',
      icon: ShoppingBag,
      tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      label: t('orders'),
      value: num(orderTotal),
      breakdown: [
        chip(t('completed'), oBy.get('COMPLETED') ?? 0),
        chip(t('inProgress'), oBy.get('IN_PROGRESS') ?? 0),
        chip(t('new'), oBy.get('NEW') ?? 0),
      ],
    },
    {
      href: '/agents',
      icon: Bot,
      tint: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
      label: t('workforceOnline'),
      value: num(agentsOnline),
      breakdown: [
        pendingApprovals > 0 ? (
          <Link
            key="needs"
            href="/approvals"
            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 tabular-nums hover:underline dark:text-amber-400"
          >
            {t('needYou', { n: num(pendingApprovals) })}
          </Link>
        ) : null,
      ],
    },
    {
      href: '/inventory',
      icon: Package2,
      tint: lowStock > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground',
      label: t('inventoryItems'),
      value: num(inventory.length),
      breakdown: [
        lowStock > 0 ? (
          <span
            key="low"
            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 tabular-nums dark:text-amber-400"
          >
            {t('low', { n: num(lowStock) })}
          </span>
        ) : null,
      ],
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {CARDS.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="group flex flex-col rounded-2xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
        >
          <div className="flex items-start gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${c.tint}`}>
              <c.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold leading-tight tabular-nums">{c.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.label}</p>
            </div>
          </div>
          {c.breakdown.filter(Boolean).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">{c.breakdown}</div>
          )}
        </Link>
      ))}
    </div>
  );
}
