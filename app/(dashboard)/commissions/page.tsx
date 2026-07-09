import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { UserRound, HandCoins, ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

// Commissions earned this month, attributed from COMPLETED orders + bookings.
// Computed deterministically from real data — no separate ledger to drift.
export default async function CommissionsPage() {
  const t = await getTranslations('commissionsPage');
  const locale = await getLocale();
  const sar = (n: number) => `${Math.round(n).toLocaleString('en')} ${t('currency')}`;
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date());
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [staff, orderAgg, bookings] = await Promise.all([
    db.staffMember.findMany({ where: { companyId, isActive: true }, orderBy: { name: 'asc' } }),
    db.order.groupBy({
      by: ['staffMemberId'],
      where: {
        companyId,
        status: 'COMPLETED',
        staffMemberId: { not: null },
        createdAt: { gte: monthStart },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.booking.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        staffMemberId: { not: null },
        startAt: { gte: monthStart },
      },
      select: { staffMemberId: true, service: { select: { price: true } } },
    }),
  ]);

  // Attributed revenue + count per staff (orders + bookings).
  const stats = new Map<string, { revenue: number; count: number }>();
  for (const o of orderAgg) {
    if (!o.staffMemberId) continue;
    stats.set(o.staffMemberId, { revenue: Number(o._sum.total ?? 0), count: o._count });
  }
  for (const b of bookings) {
    if (!b.staffMemberId) continue;
    const cur = stats.get(b.staffMemberId) ?? { revenue: 0, count: 0 };
    cur.revenue += Number(b.service?.price ?? 0);
    cur.count += 1;
    stats.set(b.staffMemberId, cur);
  }

  const rows = staff.map((s) => {
    const { revenue, count } = stats.get(s.id) ?? { revenue: 0, count: 0 };
    const rate = Number(s.commissionRate);
    const target = s.monthlyTarget != null ? Number(s.monthlyTarget) : null;
    let commission = 0;
    let basis = '';
    if (s.commissionType === 'PERCENT_SALES') {
      commission = (revenue * rate) / 100;
      basis = t('basisPercent', { rate, revenue: sar(revenue) });
    } else if (s.commissionType === 'FIXED_PER_ORDER') {
      commission = count * rate;
      basis = t('basisPerOrder', { count, amount: sar(rate) });
    } else {
      const hit = target != null && revenue >= target;
      commission = hit ? rate : 0;
      basis = hit
        ? t('basisTargetHit', { amount: sar(rate) })
        : t('basisTargetProgress', { revenue: sar(revenue), target: sar(target ?? 0) });
    }
    return { staff: s, revenue, count, commission, basis, target };
  });

  const totalCommission = rows.reduce((sum, r) => sum + r.commission, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle', { month: monthLabel })}
          </p>
        </div>
        <Link
          href="/staff"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
        >
          {t('manageStaff')} <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>

      {/* Totals. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('payable')}</p>
            <HandCoins className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{sar(totalCommission)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('attributedRevenue')}</p>
            <UserRound className="size-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{sar(totalRevenue)}</p>
        </div>
      </div>

      {/* Per-staff breakdown. */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ staff: s, revenue, count, commission, basis, target }) => {
            const pct = target && target > 0 ? Math.min(100, Math.round((revenue / target) * 100)) : null;
            return (
              <div key={s.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{s.name}</p>
                      {s.role && <span className="text-xs text-muted-foreground">{s.role}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {t('sales', { count })} · {basis}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {sar(commission)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{t('commission')}</p>
                  </div>
                </div>
                {pct != null && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>{t('targetProgress')}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
