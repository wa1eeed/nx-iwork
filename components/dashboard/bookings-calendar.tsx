'use client';

import { useMemo, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, CalendarDays, List, Check, X, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { setBookingStatus, setBookingStaff } from '@/lib/actions/bookings';
import type { BookingStatus } from '@prisma/client';

export interface CalBooking {
  id: string;
  ref: string | null;
  title: string;
  startAt: string; // ISO
  status: BookingStatus;
  customerName: string | null;
  staffMemberId: string | null;
}

const DOT: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-500',
  CONFIRMED: 'bg-sky-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-rose-500',
  WAITLIST: 'bg-orange-400',
};
const CHIP: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  CONFIRMED: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 line-through',
  WAITLIST: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export function BookingsCalendar({
  bookings,
  staff = [],
}: {
  bookings: CalBooking[];
  staff?: { id: string; name: string }[];
}) {
  const t = useTranslations('pages.bookings');
  const locale = useLocale();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(() => dayKey(new Date()));
  const [pending, startTransition] = useTransition();

  const byDay = useMemo(() => {
    const map = new Map<string, CalBooking[]>();
    for (const b of bookings) {
      const k = dayKey(new Date(b.startAt));
      (map.get(k) ?? map.set(k, []).get(k)!).push(b);
    }
    for (const list of map.values()) list.sort((a, z) => a.startAt.localeCompare(z.startAt));
    return map;
  }, [bookings]);

  // 6-week grid starting on the Sunday on/before the 1st.
  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const grid: Date[] = [];
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    for (let i = 0; i < 42; i++) {
      grid.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return grid;
  }, [month]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month);
  const weekdays = useMemo(() => {
    const base = new Date(2026, 1, 1); // a Sunday
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
        new Date(base.getFullYear(), base.getMonth(), base.getDate() + i),
      ),
    );
  }, [locale]);

  const todayKey = dayKey(new Date());
  const selectedList = byDay.get(selected) ?? [];
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  const act = (id: string, status: BookingStatus) =>
    startTransition(async () => {
      const res = await setBookingStatus(id, status);
      if (!res.ok) toast.error(t('actionFailed'));
    });

  const changeStaff = (id: string, staffMemberId: string) =>
    startTransition(async () => {
      const res = await setBookingStaff(id, staffMemberId || null);
      if (!res.ok) toast.error(t('actionFailed'));
    });

  function actionsFor(b: CalBooking) {
    if (b.status === 'PENDING')
      return (
        <>
          <IconBtn label={t('confirm')} onClick={() => act(b.id, 'CONFIRMED')} disabled={pending}><Check className="h-4 w-4" /></IconBtn>
          <IconBtn label={t('cancel')} onClick={() => act(b.id, 'CANCELLED')} disabled={pending}><X className="h-4 w-4" /></IconBtn>
        </>
      );
    if (b.status === 'CONFIRMED')
      return (
        <>
          <IconBtn label={t('markDone')} onClick={() => act(b.id, 'COMPLETED')} disabled={pending}><CheckCheck className="h-4 w-4" /></IconBtn>
          <IconBtn label={t('cancel')} onClick={() => act(b.id, 'CANCELLED')} disabled={pending}><X className="h-4 w-4" /></IconBtn>
        </>
      );
    if (b.status === 'WAITLIST')
      return (
        <>
          {/* Promote off the waitlist when a spot opens. */}
          <IconBtn label={t('confirm')} onClick={() => act(b.id, 'CONFIRMED')} disabled={pending}><Check className="h-4 w-4" /></IconBtn>
          <IconBtn label={t('cancel')} onClick={() => act(b.id, 'CANCELLED')} disabled={pending}><X className="h-4 w-4" /></IconBtn>
        </>
      );
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, -1))} aria-label="prev">
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div className="min-w-40 text-center text-sm font-semibold">{monthLabel}</div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))} aria-label="next">
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(todayKey); }}>
            {t('today')}
          </Button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <button onClick={() => setView('calendar')} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs', view === 'calendar' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>
            <CalendarDays className="h-3.5 w-3.5" />{t('calendar')}
          </button>
          <button onClick={() => setView('list')} className={cn('flex items-center gap-1 rounded-md px-2 py-1 text-xs', view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>
            <List className="h-3.5 w-3.5" />{t('list')}
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <BookingList bookings={[...bookings].sort((a, z) => a.startAt.localeCompare(z.startAt))} time={time} locale={locale} t={t} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          {/* Month grid */}
          <div className="rounded-xl border">
            <div className="grid grid-cols-7 border-b text-center text-[11px] text-muted-foreground">
              {weekdays.map((w) => <div key={w} className="py-2">{w}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                const k = dayKey(d);
                const inMonth = d.getMonth() === month.getMonth();
                const items = byDay.get(k) ?? [];
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(k)}
                    className={cn(
                      'min-h-20 border-b border-e p-1.5 text-start align-top transition-colors [&:nth-child(7n)]:border-e-0',
                      inMonth ? 'bg-background hover:bg-accent/50' : 'bg-muted/30 text-muted-foreground',
                      selected === k && 'ring-2 ring-inset ring-primary',
                    )}
                  >
                    <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]', k === todayKey && 'bg-primary text-primary-foreground')}>
                      {d.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 2).map((b) => (
                        <div key={b.id} className={cn('truncate rounded px-1 py-0.5 text-[10px]', CHIP[b.status])}>
                          {b.customerName || b.title}
                        </div>
                      ))}
                      {items.length > 2 && <div className="px-1 text-[10px] text-muted-foreground">+{items.length - 2}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day panel */}
          <div className="rounded-xl border p-3">
            <p className="mb-3 text-sm font-semibold">
              {new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(dayFromKey(selected))}
            </p>
            {selectedList.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">{t('noBookingsThisDay')}</p>
            ) : (
              <div className="space-y-2">
                {selectedList.map((b) => (
                  <div key={b.id} className="rounded-lg border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[b.status])} />
                      <span className="text-xs font-medium" dir="ltr">{time(b.startAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-xs">{b.customerName || b.title}</span>
                    </div>
                    {(b.customerName && b.title) && <p className="mt-0.5 ps-4 text-[11px] text-muted-foreground truncate">{b.title}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 ps-4">
                      {actionsFor(b)}
                      {staff.length > 0 && (
                        <select
                          className="h-7 rounded-md border bg-background px-1.5 text-[11px]"
                          value={b.staffMemberId ?? ''}
                          onChange={(e) => changeStaff(b.id, e.target.value)}
                          disabled={pending}
                          aria-label="Staff"
                          title="Attribute to staff (commissions)"
                        >
                          <option value="">— staff —</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function dayFromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m, d);
}

function IconBtn({ label, children, onClick, disabled }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50">
      {children}{label}
    </button>
  );
}

function BookingList({ bookings, time, locale, t }: { bookings: CalBooking[]; time: (iso: string) => string; locale: string; t: ReturnType<typeof useTranslations> }) {
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  return (
    <div className="grid gap-2">
      {bookings.map((b) => (
        <div key={b.id} className="flex items-center gap-3 rounded-lg border p-3">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[b.status])} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-sm font-medium">
              {b.ref && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">{b.ref}</span>}
              {b.customerName || b.title}
            </p>
            <p className="text-xs text-muted-foreground" dir="ltr">{day(b.startAt)} · {time(b.startAt)}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{t(`status.${b.status}`)}</span>
        </div>
      ))}
    </div>
  );
}
