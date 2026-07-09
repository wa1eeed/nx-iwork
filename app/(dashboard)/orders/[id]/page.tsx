import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, User, Phone, Mail, UserCog, ShoppingBag, StickyNote, TicketPercent } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

const ORDER_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  NEW: { ar: 'جديد', en: 'New', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  CONFIRMED: { ar: 'مؤكّد', en: 'Confirmed', cls: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
  IN_PROGRESS: { ar: 'قيد التنفيذ', en: 'In progress', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  CANCELLED: { ar: 'ملغى', en: 'Cancelled', cls: 'bg-muted text-muted-foreground' },
};
const PAY_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
  PENDING: { ar: 'بانتظار الدفع', en: 'Pending', cls: 'text-amber-600 dark:text-amber-400' },
  PAID: { ar: 'مدفوع', en: 'Paid', cls: 'text-emerald-600 dark:text-emerald-400' },
  REFUNDED: { ar: 'مسترجع', en: 'Refunded', cls: 'text-muted-foreground' },
  FAILED: { ar: 'فشل', en: 'Failed', cls: 'text-destructive' },
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

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('biz.detail');
  const locale = await getLocale();
  const en = locale === 'en';
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const o = await db.order.findFirst({
    where: { id, companyId },
    select: {
      id: true, orderNumber: true, type: true, status: true, paymentStatus: true, createdAt: true,
      customerName: true, customerPhone: true, customerEmail: true, customerNotes: true,
      subtotal: true, discount: true, vat: true, total: true, currency: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
      service: { select: { title: true } },
      items: { select: { id: true, quantity: true, unitPrice: true, total: true, product: { select: { title: true } } } },
      staffMember: { select: { id: true, name: true, role: true } },
      coupon: { select: { code: true } },
    },
  });
  if (!o) notFound();

  const cur = en ? o.currency : 'ر.س';
  const money = (v: unknown) => `${Math.round(Number(v)).toLocaleString('en')} ${cur}`;
  const st = ORDER_STATUS[o.status] ?? ORDER_STATUS.NEW;
  const pay = PAY_STATUS[o.paymentStatus] ?? PAY_STATUS.PENDING;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4 rtl:rotate-180" /> {t('back')}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight" dir="ltr">#{o.orderNumber}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{en ? st.en : st.ar}</span>
        <span className="text-xs text-muted-foreground">{dateFmt.format(o.createdAt)}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Customer */}
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('customer')}</div>
          <div className="divide-y">
            <Row icon={User} label={t('customer')}>
              {o.customer ? (
                <Link href={`/customers/${o.customer.id}`} className="text-primary hover:underline">
                  {o.customer.name}
                </Link>
              ) : (
                o.customerName
              )}
            </Row>
            {(o.customer?.phone || o.customerPhone) && (
              <Row icon={Phone} label={t('phone')}><span dir="ltr">{o.customer?.phone || o.customerPhone}</span></Row>
            )}
            {(o.customer?.email || o.customerEmail) && (
              <Row icon={Mail} label={t('email')}><span dir="ltr">{o.customer?.email || o.customerEmail}</span></Row>
            )}
          </div>
        </div>

        {/* Fulfilment */}
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('status')}</div>
          <div className="divide-y">
            <Row icon={ShoppingBag} label={t('payment')}>
              <span className={pay.cls}>{en ? pay.en : pay.ar}</span>
            </Row>
            {o.coupon && (
              <Row icon={TicketPercent} label={t('coupon')}><span className="font-mono" dir="ltr">{o.coupon.code}</span></Row>
            )}
            <Row icon={UserCog} label={t('staff')}>
              {o.staffMember ? (
                <Link href={`/staff/${o.staffMember.id}`} className="text-primary hover:underline">{o.staffMember.name}</Link>
              ) : (
                <span className="text-muted-foreground">{t('unassigned')}</span>
              )}
            </Row>
          </div>
        </div>
      </div>

      {/* Items / service + totals */}
      <div className="rounded-2xl border bg-card">
        <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('items')}</div>
        <div className="divide-y">
          {o.service && (
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{o.service.title}</span>
            </div>
          )}
          {o.items.map((it) => (
            <div key={it.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {it.product?.title ?? '—'} <span className="text-muted-foreground">× {it.quantity}</span>
              </span>
              <span className="tabular-nums">{money(it.total)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1.5 border-t px-4 py-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t('subtotal')}</span><span className="tabular-nums">{money(o.subtotal)}</span>
          </div>
          {Number(o.discount) > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>{t('discount')}</span><span className="tabular-nums">−{money(o.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>{t('vat')}</span><span className="tabular-nums">{money(o.vat)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>{t('total')}</span><span className="tabular-nums">{money(o.total)}</span>
          </div>
        </div>
      </div>

      {o.customerNotes && (
        <div className="rounded-2xl border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-semibold">{t('notes')}</div>
          <div className="flex items-start gap-3 px-4 py-3">
            <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{o.customerNotes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
