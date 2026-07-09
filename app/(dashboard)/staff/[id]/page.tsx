import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, CalendarClock, ShoppingBag, ArrowUpRight, HandCoins } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import type { CommissionType } from '@prisma/client';

function commissionLabel(type: CommissionType, rate: number, target: number | null, en: boolean): string {
  if (type === 'PERCENT_SALES') return en ? `${rate}% of sales` : `${rate}% من المبيعات`;
  if (type === 'FIXED_PER_ORDER') return en ? `${rate} SAR / order` : `${rate} ر.س لكل طلب`;
  return en ? `${rate} SAR at ${target ?? 0} target` : `${rate} ر.س عند بلوغ ${target ?? 0}`;
}

export default async function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('biz.detail');
  const ts = await getTranslations('pages.bookings');
  const locale = await getLocale();
  const en = locale === 'en';
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const member = await db.staffMember.findFirst({
    where: { id, companyId },
    select: { id: true, ref: true, name: true, role: true, bio: true, image: true, commissionType: true, commissionRate: true, monthlyTarget: true },
  });
  if (!member) notFound();

  const [queue, recentBookings, recentOrders, salesAgg] = await Promise.all([
    db.booking.findMany({
      where: { companyId, staffMemberId: id, status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { gte: now } },
      orderBy: { startAt: 'asc' },
      take: 12,
      select: { id: true, title: true, startAt: true, status: true, customer: { select: { name: true } }, service: { select: { title: true } } },
    }),
    db.booking.findMany({
      where: { companyId, staffMemberId: id },
      orderBy: { startAt: 'desc' },
      take: 8,
      select: { id: true, title: true, startAt: true, status: true, customer: { select: { name: true } }, service: { select: { title: true } } },
    }),
    db.order.findMany({
      where: { companyId, staffMemberId: id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, orderNumber: true, customerName: true, total: true, status: true, createdAt: true },
    }),
    db.order.aggregate({
      where: { companyId, staffMemberId: id, status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { total: true },
    }),
  ]);

  const attributed = Number(salesAgg._sum.total ?? 0);
  const timeFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const money = (v: unknown) => `${Math.round(Number(v)).toLocaleString('en')} ${en ? 'SAR' : 'ر.س'}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/staff" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4 rtl:rotate-180" /> {t('back')}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        {member.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.image} alt={member.name} className="size-20 shrink-0 rounded-2xl border object-cover" />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-bold text-primary">
            {member.name.trim()[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {member.ref && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" dir="ltr">{member.ref}</span>}
            <h1 className="text-xl font-semibold tracking-tight">{member.name}</h1>
          </div>
          {member.role && <p className="mt-0.5 text-sm text-muted-foreground">{member.role}</p>}
        </div>
        <Link href="/commissions" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition hover:bg-accent">
          <HandCoins className="size-4" /> {t('commission')}
        </Link>
      </div>

      {/* Commission + attributed sales */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('commission')}</p>
          <p className="mt-1 font-semibold">{commissionLabel(member.commissionType, Number(member.commissionRate), member.monthlyTarget != null ? Number(member.monthlyTarget) : null, en)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('attributedSales')}</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{money(attributed)}</p>
        </div>
      </div>

      {member.bio && <p className="rounded-2xl border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>}

      {/* Appointment queue */}
      <div className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <CalendarClock className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('todayQueue')}</h2>
        </div>
        {queue.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="divide-y">
            {queue.map((b) => (
              <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
                <span className="text-xs tabular-nums text-muted-foreground" dir="ltr">{timeFmt.format(b.startAt)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.customer?.name || b.title}</p>
                  {b.service?.title && <p className="truncate text-xs text-muted-foreground">{b.service.title}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{ts(`status.${b.status}`)}</span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground rtl:-scale-x-100" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent bookings */}
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-3 text-sm font-semibold">{t('recentBookings')}</div>
          {recentBookings.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="divide-y">
              {recentBookings.map((b) => (
                <Link key={b.id} href={`/bookings/${b.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{b.customer?.name || b.title}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{timeFmt.format(b.startAt)}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{ts(`status.${b.status}`)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="rounded-2xl border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ShoppingBag className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t('recentOrders')}</h2>
          </div>
          {recentOrders.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <div className="divide-y">
              {recentOrders.map((o) => (
                <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" dir="ltr">#{o.orderNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">{o.customerName}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{money(o.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
