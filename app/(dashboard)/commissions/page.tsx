import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserRound, HandCoins, ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

function sar(n: number) {
  return `${Math.round(n).toLocaleString('en')} SAR`;
}

const MONTH = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });

// Commissions earned this month, attributed from COMPLETED orders + bookings.
// Computed deterministically from real data — no separate ledger to drift.
export default async function CommissionsPage() {
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
      basis = `${rate}% of ${sar(revenue)}`;
    } else if (s.commissionType === 'FIXED_PER_ORDER') {
      commission = count * rate;
      basis = `${count} × ${sar(rate)}`;
    } else {
      const hit = target != null && revenue >= target;
      commission = hit ? rate : 0;
      basis = hit ? `Target reached — ${sar(rate)} bonus` : `${sar(revenue)} / ${sar(target ?? 0)} target`;
    }
    return { staff: s, revenue, count, commission, basis, target };
  });

  const totalCommission = rows.reduce((sum, r) => sum + r.commission, 0);
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commissions</h1>
          <p className="text-sm text-muted-foreground">
            Earned this month ({MONTH.format(now)}) from completed orders and bookings.
          </p>
        </div>
        <Link
          href="/staff"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
        >
          Manage staff <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>

      {/* Totals. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Commissions payable</p>
            <HandCoins className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{sar(totalCommission)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Attributed revenue</p>
            <UserRound className="size-4 text-indigo-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{sar(totalRevenue)}</p>
        </div>
      </div>

      {/* Per-staff breakdown. */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No active staff yet. Add staff and attribute orders/bookings to them to track commissions.
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
                      {count} sale{count === 1 ? '' : 's'} · {basis}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {sar(commission)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">commission</p>
                  </div>
                </div>
                {pct != null && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                      <span>Target progress</span>
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
