import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { CouponManager, type CouponRow } from '@/components/dashboard/coupon-manager';

export default async function CouponsPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const coupons = await db.coupon.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  const rows: CouponRow[] = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    value: Number(c.value),
    scope: c.scope,
    minSubtotal: c.minSubtotal != null ? Number(c.minSubtotal) : null,
    maxRedemptions: c.maxRedemptions,
    usedCount: c.usedCount,
    startsAt: c.startsAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    isActive: c.isActive,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Discount coupons</h1>
        <p className="text-sm text-muted-foreground">
          Offer a percentage or fixed discount on products, services, or bookings.
        </p>
      </div>
      <CouponManager coupons={rows} />
    </div>
  );
}
