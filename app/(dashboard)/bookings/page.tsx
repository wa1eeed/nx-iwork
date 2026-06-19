import { redirect } from 'next/navigation';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Card, CardContent } from '@/components/ui/card';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'بانتظار التأكيد', cls: 'text-amber-500' },
  CONFIRMED: { label: 'مؤكّد', cls: 'text-emerald-500' },
  CANCELLED: { label: 'ملغى', cls: 'text-destructive' },
  COMPLETED: { label: 'مكتمل', cls: 'text-muted-foreground' },
};

function fmt(d: Date): string {
  return d.toLocaleString('ar', { dateStyle: 'full', timeStyle: 'short' });
}

// Bookings module. Agents create bookings via the create_booking tool; owners
// monitor them here.
export default async function BookingsPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { hasBookings: true },
  });
  // Module disabled → guide back to Modules.
  if (!company?.hasBookings) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CalendarX className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">موديول الحجوزات غير مفعّل.</p>
          <a href="/modules" className="text-sm text-primary underline">
            فعّله من الموديولات
          </a>
        </CardContent>
      </Card>
    );
  }

  const bookings = await db.booking.findMany({
    where: { companyId },
    orderBy: { startAt: 'asc' },
    take: 200,
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      status: true,
      customer: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">الحجوزات</h1>
        <p className="text-sm text-muted-foreground">
          المواعيد التي ينشئها وكلاؤك أو يحجزها عملاؤك.
        </p>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarCheck className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">لا حجوزات بعد.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => {
            const st = STATUS[b.status] ?? STATUS.CONFIRMED;
            return (
              <Card key={b.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.customer?.name ? `${b.customer.name} · ` : ''}
                      {fmt(b.startAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${st.cls}`}>{st.label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
