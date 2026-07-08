import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, ShoppingBag, CalendarCheck, ListChecks } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Card, CardContent } from '@/components/ui/card';
import { CustomerEditor } from '@/components/dashboard/customer-editor';
import { STATUS_CLS } from '@/components/dashboard/customer-manager';
import { OpportunityActivity, type ActivityItem } from '@/components/dashboard/opportunity-activity';
import { formatDateTime } from '@/lib/format';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations('crm');
  const locale = await getLocale();
  const fmt = (d: Date) => formatDateTime(d, locale, { dateStyle: 'medium', timeStyle: 'short' });
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const customer = await db.customer.findFirst({
    where: { id, companyId },
    include: { assignedAgent: { select: { name: true } } },
  });
  if (!customer) notFound();

  const settings = await db.businessSettings.findUnique({
    where: { companyId },
    select: { currencySymbol: true },
  });
  const currency = settings?.currencySymbol ?? 'SAR';

  const [orders, bookings, tasks, notes] = await Promise.all([
    db.order.findMany({
      where: { customerId: id, companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
    }),
    db.booking.findMany({
      where: { customerId: id, companyId },
      orderBy: { startAt: 'desc' },
      take: 50,
      select: { id: true, title: true, startAt: true, status: true },
    }),
    db.task.findMany({
      where: { customerId: id, companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, title: true, status: true, createdAt: true, kind: true, dueAt: true, startAt: true },
    }),
    db.customerNote.findMany({
      where: { customerId: id, companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, type: true, body: true, createdAt: true },
    }),
  ]);

  // Reminders/meetings (Tasks) + notes/visits (CustomerNote) → one timeline.
  const activityTasks = tasks.filter((tk) => tk.kind === 'REMINDER' || tk.kind === 'APPOINTMENT');
  const agentTasks = tasks.filter((tk) => tk.kind === 'AGENT_TASK');
  const activity: ActivityItem[] = [
    ...notes.map((n) => ({
      id: n.id,
      kind: n.type as 'NOTE' | 'VISIT',
      body: n.body,
      at: n.createdAt.toISOString(),
      done: false,
    })),
    ...activityTasks.map((tk) => ({
      id: tk.id,
      kind: (tk.kind === 'REMINDER' ? 'REMINDER' : 'MEETING') as 'REMINDER' | 'MEETING',
      body: tk.title,
      at: (tk.kind === 'REMINDER' ? tk.dueAt ?? tk.createdAt : tk.startAt ?? tk.createdAt).toISOString(),
      done: tk.status === 'DONE',
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // Booking / spend KPIs (from the loaded history, capped at 50 each).
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED').length;
  const totalSpend = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const stats = [
    { label: t('statBookings'), value: String(bookings.length) },
    { label: t('statCompleted'), value: String(completedBookings) },
    { label: t('statOrders'), value: String(orders.length) },
    { label: t('statSpend'), value: `${totalSpend} ${currency}` },
  ];

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {t('backToList')}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-xl font-bold text-primary">
          {Array.from(customer.name)[0] ?? '؟'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {customer.ref && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" dir="ltr">
                {customer.ref}
              </span>
            )}
            {customer.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLS[customer.status]}`}>{t(`status.${customer.status}`)}</span>
            {customer.assignedAgent?.name ? ` · ${t('assignedTo')}: ${customer.assignedAgent.name}` : ''}
            {customer.source ? ` · ${t('source')}: ${customer.source}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border p-3">
            <p className="text-lg font-semibold" dir="ltr">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <CustomerEditor
        initial={{
          id: customer.id,
          name: customer.name,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          status: customer.status,
          notes: customer.notes ?? '',
        }}
      />

      {/* Activity: notes / visits / reminders / meetings + convert to order */}
      <OpportunityActivity customerId={customer.id} items={activity} status={customer.status} />

      {/* History */}
      <div className="grid gap-4 lg:grid-cols-3">
        <HistoryCard icon={ShoppingBag} title={t('orders')} empty={t('noOrders')}>
          {orders.map((o) => (
            <Row key={o.id} title={`#${o.orderNumber}`} sub={`${o.total.toString()} ${currency} · ${o.status}`} when={fmt(o.createdAt)} />
          ))}
        </HistoryCard>
        <HistoryCard icon={CalendarCheck} title={t('bookings')} empty={t('noBookings')}>
          {bookings.map((b) => (
            <Row key={b.id} title={b.title} sub={b.status} when={fmt(b.startAt)} />
          ))}
        </HistoryCard>
        <HistoryCard icon={ListChecks} title={t('relatedTasks')} empty={t('noTasks')}>
          {agentTasks.map((tk) => (
            <Row key={tk.id} title={tk.title} sub={tk.status} when={fmt(tk.createdAt)} />
          ))}
        </HistoryCard>
      </div>
    </div>
  );
}

function HistoryCard({
  icon: Icon,
  title,
  empty,
  children,
}: {
  icon: typeof ShoppingBag;
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) && children.length > 0;
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </p>
        {hasItems ? <div className="space-y-2">{children}</div> : <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ title, sub, when }: { title: string; sub: string; when: string }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="truncate text-sm font-medium">{title}</p>
      <p className="text-[11px] text-muted-foreground">{sub} · {when}</p>
    </div>
  );
}
