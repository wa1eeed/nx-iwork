import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, User, CalendarClock, Tag, LayoutGrid, UserCog, Phone, Mail, StickyNote } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import type { BookingStatus } from '@prisma/client';

const STATUS_CLS: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  CONFIRMED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  CANCELLED: 'bg-destructive/15 text-destructive',
  COMPLETED: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  WAITLIST: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  NO_SHOW: 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-400',
};

function Row({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-medium">{children}</div>
      </div>
    </div>
  );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('biz.detail');
  const ts = await getTranslations('pages.bookings');
  const locale = await getLocale();
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const b = await db.booking.findFirst({
    where: { id, companyId },
    select: {
      id: true, ref: true, title: true, startAt: true, endAt: true, status: true, notes: true, createdAt: true,
      customer: { select: { id: true, name: true, phone: true, email: true, ref: true } },
      service: { select: { title: true, durationMin: true, department: { select: { name: true, color: true } } } },
      staffMember: { select: { id: true, name: true, role: true } },
    },
  });
  if (!b) notFound();

  const dateFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
  const durationMin =
    b.service?.durationMin ??
    (b.endAt ? Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60000) : null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/bookings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4 rtl:rotate-180" /> {t('back')}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        {b.ref && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" dir="ltr">{b.ref}</span>
        )}
        <h1 className="text-xl font-semibold tracking-tight">{b.customer?.name || b.title}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[b.status]}`}>
          {ts(`status.${b.status}`)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Customer */}
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('customer')}</div>
          {b.customer ? (
            <div className="divide-y">
              <Row icon={User} label={t('customer')}>
                <Link href={`/customers/${b.customer.id}`} className="text-primary hover:underline">
                  {b.customer.name}
                </Link>
              </Row>
              {b.customer.phone && <Row icon={Phone} label={t('phone')}><span dir="ltr">{b.customer.phone}</span></Row>}
              {b.customer.email && <Row icon={Mail} label={t('email')}><span dir="ltr">{b.customer.email}</span></Row>}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('walkIn')}</p>
          )}
        </div>

        {/* Appointment */}
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('appointment')}</div>
          <div className="divide-y">
            <Row icon={CalendarClock} label={t('date')}>{dateFmt.format(b.startAt)}</Row>
            <Row icon={CalendarClock} label={t('time')}><span dir="ltr">{timeFmt.format(b.startAt)}</span></Row>
            {durationMin != null && (
              <Row icon={CalendarClock} label={t('duration')}>{durationMin} {t('minutes')}</Row>
            )}
          </div>
        </div>

        {/* Service + section */}
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('service')}</div>
          <div className="divide-y">
            <Row icon={Tag} label={t('service')}>{b.service?.title || b.title}</Row>
            {b.service?.department && (
              <Row icon={LayoutGrid} label={t('section')}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ backgroundColor: b.service.department.color }} />
                  {b.service.department.name}
                </span>
              </Row>
            )}
          </div>
        </div>

        {/* Staff */}
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('staff')}</div>
          <Row icon={UserCog} label={t('staff')}>
            {b.staffMember ? (
              <Link href={`/staff/${b.staffMember.id}`} className="text-primary hover:underline">
                {b.staffMember.name}
                {b.staffMember.role ? <span className="text-muted-foreground"> · {b.staffMember.role}</span> : null}
              </Link>
            ) : (
              <span className="text-muted-foreground">{t('unassigned')}</span>
            )}
          </Row>
        </div>
      </div>

      {b.notes && (
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('notes')}</div>
          <div className="flex items-start gap-3 px-4 py-3">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{b.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
