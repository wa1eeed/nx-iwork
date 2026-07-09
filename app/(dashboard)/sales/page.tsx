import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  CircleDollarSign,
  ShoppingBag,
  Receipt,
  TrendingUp,
  Wallet as WalletIcon,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { formatDate } from '@/lib/format';
import type { OrderStatus } from '@prisma/client';

// SAR, Latin digits, no fractional noise — a financial dashboard reads cleaner
// in whole riyals.
function sar(n: number) {
  return `${Math.round(n).toLocaleString('en')} SAR`;
}

const ORDER_STATUS: Record<string, { label: string; dot: string }> = {
  NEW: { label: 'New', dot: 'bg-sky-500' },
  CONFIRMED: { label: 'Confirmed', dot: 'bg-indigo-500' },
  IN_PROGRESS: { label: 'In progress', dot: 'bg-amber-500' },
  COMPLETED: { label: 'Completed', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Cancelled', dot: 'bg-muted-foreground/40' },
};

const INVOICE_BADGE: Record<string, string> = {
  DRAFT: 'text-muted-foreground bg-muted',
  OPEN: 'text-amber-600 bg-amber-500/10 dark:text-amber-400',
  PAID: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
  FAILED: 'text-destructive bg-destructive/10',
  REFUNDED: 'text-muted-foreground bg-muted',
};

const STATUS_ORDER: OrderStatus[] = ['NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// The commercial cockpit: realized revenue, order pipeline, and invoices — all
// tenant-scoped and derived from real Orders + Invoices.
export default async function SalesPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [completedAgg, monthAgg, allAgg, byStatus, recentOrders, invoices, wallet, company] =
    await Promise.all([
      db.order.aggregate({ where: { companyId, status: 'COMPLETED' }, _sum: { total: true } }),
      db.order.aggregate({
        where: { companyId, status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } },
        _sum: { total: true },
      }),
      db.order.aggregate({
        where: { companyId, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: true,
      }),
      db.order.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
        _sum: { total: true },
      }),
      db.order.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
      }),
      db.invoice.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, number: true, total: true, status: true, createdAt: true, pdfUrl: true },
      }),
      db.wallet.findUnique({ where: { companyId }, select: { balance: true } }),
      db.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
    ]);

  const revenue = Number(completedAgg._sum.total ?? 0);
  const monthRevenue = Number(monthAgg._sum.total ?? 0);
  const grossSales = Number(allAgg._sum.total ?? 0);
  const orderCount = allAgg._count;
  const avgOrder = orderCount > 0 ? grossSales / orderCount : 0;
  const walletBalance = Number(wallet?.balance ?? 0);

  const statusMap = new Map(
    byStatus.map((s) => [s.status, { count: s._count, total: Number(s._sum.total ?? 0) }])
  );
  const maxStatusTotal = Math.max(1, ...byStatus.map((s) => Number(s._sum.total ?? 0)));

  const KPIS = [
    { label: 'Revenue (completed)', value: sar(revenue), icon: CircleDollarSign, accent: 'text-emerald-500' },
    { label: 'This month', value: sar(monthRevenue), icon: TrendingUp, accent: 'text-sky-500' },
    { label: 'Orders', value: orderCount.toLocaleString('en'), icon: ShoppingBag, accent: 'text-amber-500' },
    { label: 'Avg. order', value: sar(avgOrder), icon: Receipt, accent: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sales &amp; financials</h1>
        <p className="text-sm text-muted-foreground">
          Revenue, orders, and invoices across your business.
        </p>
      </div>

      {/* KPI cards. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={`size-4 ${accent}`} />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Recent sales. */}
          <div className="rounded-2xl border bg-card">
            <div className="flex items-center justify-between border-b p-4">
              <p className="font-semibold">Recent sales</p>
              <Link
                href="/orders"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                All orders <ArrowRight className="size-3 rtl:rotate-180" />
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No sales yet.</p>
            ) : (
              <div className="divide-y">
                {recentOrders.map((o) => {
                  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.NEW;
                  return (
                    <div key={o.id} className="flex items-center gap-3 p-3.5">
                      <span className={`size-2 shrink-0 rounded-full ${st.dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">
                          {o.orderNumber} · {st.label}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">{sar(Number(o.total))}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invoices. */}
          <div className="rounded-2xl border bg-card">
            <div className="border-b p-4">
              <p className="font-semibold">Invoices</p>
            </div>
            {invoices.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="divide-y">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 p-3.5">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium tabular-nums" dir="ltr">
                        {inv.number}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${INVOICE_BADGE[inv.status] ?? ''}`}
                    >
                      {inv.status}
                    </span>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{sar(Number(inv.total))}</p>
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail: pipeline by status + wallet. */}
        <aside className="space-y-6">
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-3 font-semibold">Orders by status</p>
            <div className="space-y-2.5">
              {STATUS_ORDER.map((s) => {
                const data = statusMap.get(s) ?? { count: 0, total: 0 };
                const st = ORDER_STATUS[s];
                return (
                  <div key={s}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {data.count} · {sar(data.total)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${st.dot}`}
                        style={{ width: `${Math.round((data.total / maxStatusTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <WalletIcon className="size-4 text-emerald-500" />
              <p className="font-semibold">Wallet</p>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums">{sar(walletBalance)}</p>
            <p className="text-xs text-muted-foreground">{company?.plan ?? 'STARTER'} plan</p>
            <div className="mt-3 flex gap-2">
              <Link
                href="/wallet"
                className="flex-1 rounded-lg border py-1.5 text-center text-xs font-medium transition hover:bg-accent"
              >
                Top up
              </Link>
              <Link
                href="/subscription"
                className="flex-1 rounded-lg border py-1.5 text-center text-xs font-medium transition hover:bg-accent"
              >
                Plan
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
