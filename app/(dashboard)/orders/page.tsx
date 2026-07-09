import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { OrderManager } from '@/components/dashboard/order-manager';

export default async function OrdersPage() {
  const t = await getTranslations('pages.orders');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [orders, staff] = companyId
    ? await Promise.all([
        db.order.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 300,
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerId: true,
            total: true,
            type: true,
            status: true,
            staffMemberId: true,
            createdAt: true,
          },
        }),
        db.staffMember.findMany({
          where: { companyId, isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <OrderManager
        staff={staff}
        orders={orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerId: o.customerId,
          total: o.total.toString(),
          type: o.type,
          status: o.status,
          staffMemberId: o.staffMemberId,
          createdAt: o.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
