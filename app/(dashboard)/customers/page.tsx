import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { CustomerManager } from '@/components/dashboard/customer-manager';

export default async function CustomersPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const customers = companyId
    ? await db.customer.findMany({
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
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">العملاء (CRM)</h1>
        <p className="text-sm text-muted-foreground">
          عملاؤك وحالتهم في مسار البيع — يسجّلهم وكلاؤك تلقائياً وتتابعهم هنا.
        </p>
      </div>

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
