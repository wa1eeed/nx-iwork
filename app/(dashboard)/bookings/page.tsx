import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_CLS: Record<string, string> = {
  PENDING: 'text-amber-500',
  CONFIRMED: 'text-emerald-500',
  CANCELLED: 'text-destructive',
  COMPLETED: 'text-muted-foreground',
};

// Bookings module. Agents create bookings via the create_booking tool; owners
// monitor them here.
export default async function BookingsPage() {
  const t = await getTranslations('pages.bookings');
  const locale = await getLocale();
  const fmt = (d: Date) => d.toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' });
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
          <p className="text-sm text-muted-foreground">{t('moduleOff')}</p>
          <a href="/modules" className="text-sm text-primary underline">
            {t('enableFromModules')}
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
      ref: true,
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
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarCheck className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => {
            const stCls = STATUS_CLS[b.status] ?? STATUS_CLS.CONFIRMED;
            return (
              <Card key={b.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <CalendarCheck className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {b.ref && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {b.ref}
                        </span>
                      )}
                      {b.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.customer?.name ? `${b.customer.name} · ` : ''}
                      {fmt(b.startAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${stCls}`}>{t(`status.${b.status}`)}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
