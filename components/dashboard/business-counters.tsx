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
      accent: 'text-emerald-500',
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
      accent: 'text-indigo-500',
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
      accent: 'text-amber-500',
      label: t('revenueMonth'),
      value: sar(Number(monthRevenue._sum.total ?? 0)),
      breakdown: [],
    },
    {
      href: '/orders',
      icon: ShoppingBag,
      accent: 'text-sky-500',
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
      accent: 'text-fuchsia-500',
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
      accent: lowStock > 0 ? 'text-amber-500' : 'text-muted-foreground',
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
          className="rounded-2xl border bg-card p-4 transition hover:bg-accent/40"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <c.icon className={`size-4 ${c.accent}`} />
          </div>
          <p className="mt-1.5 text-xl font-bold tabular-nums">{c.value}</p>
          {c.breakdown.filter(Boolean).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">{c.breakdown}</div>
          )}
        </Link>
      ))}
    </div>
  );
}
