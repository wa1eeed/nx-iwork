import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { OrderManager } from '@/components/dashboard/order-manager';

export default async function OrdersPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const orders = companyId
    ? await db.order.findMany({
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
          createdAt: true,
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">الطلبات</h1>
        <p className="text-sm text-muted-foreground">
          الطلبات الواردة من صفحتك العامة أو التي يسجّلها وكلاؤك — يعالجها الوكيل المسؤول تلقائياً.
        </p>
      </div>

      <OrderManager
        orders={orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          customerId: o.customerId,
          total: o.total.toString(),
          type: o.type,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
