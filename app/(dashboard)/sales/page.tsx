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
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { formatDate } from '@/lib/format';
import type { OrderStatus } from '@prisma/client';

// Accent dot per order status (labels come from i18n).
const ORDER_DOT: Record<string, string> = {
  NEW: 'bg-sky-500',
  CONFIRMED: 'bg-indigo-500',
  IN_PROGRESS: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-muted-foreground/40',
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
  const t = await getTranslations('salesPage');
  const locale = await getLocale();
  const sar = (n: number) => `${Math.round(n).toLocaleString('en')} ${t('currency')}`;
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
    { label: t('kpiRevenue'), value: sar(revenue), icon: CircleDollarSign, accent: 'text-emerald-500' },
    { label: t('kpiMonth'), value: sar(monthRevenue), icon: TrendingUp, accent: 'text-sky-500' },
    { label: t('kpiOrders'), value: orderCount.toLocaleString(locale), icon: ShoppingBag, accent: 'text-amber-500' },
    { label: t('kpiAvg'), value: sar(avgOrder), icon: Receipt, accent: 'text-indigo-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('subtitle')}
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
              <p className="font-semibold">{t('recentSales')}</p>
              <Link
                href="/orders"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {t('allOrders')} <ArrowRight className="size-3 rtl:rotate-180" />
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t('noSales')}</p>
            ) : (
              <div className="divide-y">
                {recentOrders.map((o) => (
                    <div key={o.id} className="flex items-center gap-3 p-3.5">
                      <span className={`size-2 shrink-0 rounded-full ${ORDER_DOT[o.status] ?? ORDER_DOT.NEW}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{o.customerName}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          <span dir="ltr">{o.orderNumber}</span> · {t(`status.${o.status}`)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">{sar(Number(o.total))}</p>
                    </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoices. */}
          <div className="rounded-2xl border bg-card">
            <div className="border-b p-4">
              <p className="font-semibold">{t('invoices')}</p>
            </div>
            {invoices.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">{t('noInvoices')}</p>
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
                      {t(`invoiceStatus.${inv.status}`)}
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
            <p className="mb-3 font-semibold">{t('ordersByStatus')}</p>
            <div className="space-y-2.5">
              {STATUS_ORDER.map((s) => {
                const data = statusMap.get(s) ?? { count: 0, total: 0 };
                const dot = ORDER_DOT[s];
                return (
                  <div key={s}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${dot}`} />
                        {t(`status.${s}`)}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {data.count} · {sar(data.total)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${dot}`}
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
              <p className="font-semibold">{t('wallet')}</p>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums">{sar(walletBalance)}</p>
            <p className="text-xs text-muted-foreground">{t('planLabel', { plan: company?.plan ?? 'STARTER' })}</p>
            <div className="mt-3 flex gap-2">
              <Link
                href="/wallet"
                className="flex-1 rounded-lg border py-1.5 text-center text-xs font-medium transition hover:bg-accent"
              >
                {t('topUp')}
              </Link>
              <Link
                href="/subscription"
                className="flex-1 rounded-lg border py-1.5 text-center text-xs font-medium transition hover:bg-accent"
              >
                {t('plan')}
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
