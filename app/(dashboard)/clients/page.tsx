import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ClientsManager, type ClientRow } from '@/components/dashboard/clients-manager';

// Directory of actual customers — anyone with at least one order. Distinct from
// the Opportunities pipeline; both link to the same 360° person detail.
export default async function ClientsPage() {
  const t = await getTranslations('clients');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  let rows: ClientRow[] = [];
  if (companyId) {
    const grouped = await db.order.groupBy({
      by: ['customerId'],
      where: { companyId, customerId: { not: null } },
      _count: { _all: true },
      _sum: { total: true },
      _max: { createdAt: true },
    });
    const ids = grouped.map((g) => g.customerId).filter((x): x is string => Boolean(x));
    const customers = ids.length
      ? await db.customer.findMany({
          where: { id: { in: ids }, companyId },
          select: { id: true, ref: true, name: true, phone: true, email: true, status: true },
        })
      : [];
    const byId = new Map(customers.map((c) => [c.id, c]));

    rows = grouped
      .filter((g) => g.customerId && byId.has(g.customerId))
      .map((g) => {
        const c = byId.get(g.customerId as string)!;
        return {
          id: c.id,
          ref: c.ref,
          name: c.name,
          phone: c.phone,
          email: c.email,
          status: c.status,
          ordersCount: g._count._all,
          totalSpent: g._sum.total ? g._sum.total.toNumber() : 0,
          lastOrderAt: g._max.createdAt ? g._max.createdAt.toISOString() : null,
        };
      })
      .sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ClientsManager clients={rows} />
    </div>
  );
}
