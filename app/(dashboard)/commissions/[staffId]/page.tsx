import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, HandCoins, UserRound, ShoppingBag, CalendarClock } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { commissionSummary } from '@/components/dashboard/staff-manager';

// Per-staff commission breakdown for the current month — every attributed order
// and completed booking that feeds the commission, with the running total. All
// derived from real data (no ledger), tenant-scoped.
export default async function CommissionDetailPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  const t = await getTranslations('commissionsPage');
  const ts = await getTranslations('staffMgr');
  const locale = await getLocale();
  const en = locale === 'en';
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(now);
  const sar = (n: number) => `${Math.round(n).toLocaleString('en')} ${t('currency')}`;

  const member = await db.staffMember.findFirst({
    where: { id: staffId, companyId },
    select: { id: true, name: true, role: true, commissionType: true, commissionRate: true, monthlyTarget: true },
  });
  if (!member) notFound();

  const [orders, bookings] = await Promise.all([
    db.order.findMany({
      where: { companyId, staffMemberId: staffId, status: 'COMPLETED', createdAt: { gte: monthStart } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderNumber: true, total: true, createdAt: true },
    }),
    db.booking.findMany({
      where: { companyId, staffMemberId: staffId, status: 'COMPLETED', startAt: { gte: monthStart } },
      orderBy: { startAt: 'desc' },
      select: { id: true, ref: true, title: true, startAt: true, service: { select: { price: true, title: true } } },
    }),
  ]);

  type Line = { id: string; kind: 'order' | 'booking'; label: string; ref: string; when: Date; amount: number };
  const lines: Line[] = [
    ...orders.map((o) => ({
      id: o.id, kind: 'order' as const, label: t('orderTag'), ref: o.orderNumber, when: o.createdAt, amount: Number(o.total),
    })),
    ...bookings.map((b) => ({
      id: b.id, kind: 'booking' as const, label: t('bookingTag'), ref: b.ref || b.service?.title || b.title,
      when: b.startAt, amount: Number(b.service?.price ?? 0),
    })),
  ].sort((a, z) => z.when.getTime() - a.when.getTime());

  const revenue = lines.reduce((s, l) => s + l.amount, 0);
  const count = lines.length;
  const rate = Number(member.commissionRate);
  const target = member.monthlyTarget != null ? Number(member.monthlyTarget) : null;
  let commission = 0;
  if (member.commissionType === 'PERCENT_SALES') commission = (revenue * rate) / 100;
  else if (member.commissionType === 'FIXED_PER_ORDER') commission = count * rate;
  else commission = target != null && revenue >= target ? rate : 0;

  const pct = target && target > 0 ? Math.min(100, Math.round((revenue / target) * 100)) : null;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/commissions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4 rtl:rotate-180" /> {t('back')}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <UserRound className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/staff/${member.id}`} className="text-xl font-semibold tracking-tight hover:underline">
            {member.name}
          </Link>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {member.role ? `${member.role} · ` : ''}
            {commissionSummary(
              { commissionType: member.commissionType, commissionRate: rate, monthlyTarget: target },
              ts
            )}
          </p>
        </div>
      </div>

      {/* Totals */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('payable')}</p>
            <HandCoins className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{sar(commission)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('attributedRevenue')}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{sar(revenue)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('sales', { count })}</p>
        </div>
      </div>

      {pct != null && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{t('targetProgress')}</span>
            <span>{sar(revenue)} / {sar(target ?? 0)} · {pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Breakdown */}
      <div className="rounded-2xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-semibold">{t('breakdown', { month: monthLabel })}</div>
        {lines.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t('noItems')}</p>
        ) : (
          <div className="divide-y">
            {lines.map((l) => (
              <Link
                key={l.id}
                href={l.kind === 'order' ? `/orders/${l.id}` : `/bookings/${l.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                {l.kind === 'order' ? (
                  <ShoppingBag className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="text-muted-foreground">{l.label} · </span>
                    <span dir="ltr">{l.ref}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{dateFmt.format(l.when)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{sar(l.amount)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
