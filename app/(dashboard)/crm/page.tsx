import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Target, AlarmClock, UserCheck, CalendarCheck, ShoppingBag } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { CustomerManager } from '@/components/dashboard/customer-manager';
import { CrmTabs } from '@/components/dashboard/crm-tabs';

// The CRM hub: pipeline (opportunities) + customers + tasks under one module,
// fronted by a whole-relationship counter strip (IBP-style).
export default async function CrmPage() {
  const t = await getTranslations('crm');
  const tb = await getTranslations('biz.crmHub');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const now = new Date();
  const [customers, openOpps, overdueTasks, wonCustomers, upcomingBookings, openOrders] =
    await Promise.all([
      db.customer.findMany({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        take: 300,
        select: {
          id: true,
          ref: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          assignedAgent: { select: { name: true } },
        },
      }),
      db.customer.count({ where: { companyId, status: { in: ['NEW', 'INTERESTED', 'NEGOTIATING'] } } }),
      db.task.count({ where: { companyId, status: { in: ['PENDING', 'WORKING'] }, dueAt: { lt: now } } }),
      db.customer.count({ where: { companyId, status: 'WON' } }),
      db.booking.count({ where: { companyId, status: 'CONFIRMED', startAt: { gte: now } } }),
      db.order.count({ where: { companyId, status: { in: ['NEW', 'CONFIRMED', 'IN_PROGRESS'] } } }),
    ]);

  const num = (n: number) => n.toLocaleString('en');
  const COUNTERS = [
    { label: tb('openOpportunities'), value: openOpps, icon: Target, accent: 'text-sky-500' },
    { label: tb('overdueTasks'), value: overdueTasks, icon: AlarmClock, accent: overdueTasks > 0 ? 'text-rose-500' : 'text-muted-foreground' },
    { label: tb('customers'), value: wonCustomers, icon: UserCheck, accent: 'text-emerald-500' },
    { label: tb('upcomingBookings'), value: upcomingBookings, icon: CalendarCheck, accent: 'text-indigo-500' },
    { label: tb('openOrders'), value: openOrders, icon: ShoppingBag, accent: 'text-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{tb('subtitle')}</p>
      </div>

      {/* Relationship counters. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {COUNTERS.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={`size-4 ${accent}`} />
            </div>
            <p className="mt-1.5 text-2xl font-bold tabular-nums">{num(value)}</p>
          </div>
        ))}
      </div>

      <CrmTabs />

      <CustomerManager
        customers={customers.map((c) => ({
          id: c.id,
          ref: c.ref,
          name: c.name,
          phone: c.phone,
          email: c.email,
          status: c.status,
          agentName: c.assignedAgent?.name ?? null,
        }))}
      />
    </div>
  );
}
