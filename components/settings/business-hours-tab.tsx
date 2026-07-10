'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Loader2, Clock, CalendarOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { saveCompanyHours, addHoliday, deleteHoliday } from '@/lib/actions/business-hours';

interface Window {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
interface Holiday {
  id: string;
  date: string;
  name: string;
}

export function BusinessHoursTab({
  initial,
}: {
  initial: { windows: Window[]; holidays: Holiday[] };
}) {
  const t = useTranslations('businessHours');
  const tc = useTranslations('common');
  const router = useRouter();
  const days = t.raw('days') as string[];

  const [windows, setWindows] = useState<Window[]>(initial.windows);
  const [holidays, setHolidays] = useState<Holiday[]>(initial.holidays);
  const [hDate, setHDate] = useState('');
  const [hName, setHName] = useState('');
  const [saving, startSave] = useTransition();
  const [addingHoliday, startHoliday] = useTransition();

  function addWindow(day: number) {
    setWindows((w) => [...w, { dayOfWeek: day, startTime: '09:00', endTime: '17:00' }]);
  }
  function updateWindow(idx: number, patch: Partial<Window>) {
    setWindows((w) => w.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  function removeWindow(idx: number) {
    setWindows((w) => w.filter((_, i) => i !== idx));
  }

  function save() {
    startSave(async () => {
      const res = await saveCompanyHours({ windows });
      if (res.ok) {
        toast.success(t('saved'));
        router.refresh();
      } else {
        toast.error(res.error === 'bad_window' ? t('badWindow') : t('saveError'));
      }
    });
  }

  function submitHoliday() {
    if (!hDate || !hName.trim()) return;
    startHoliday(async () => {
      const res = await addHoliday({ date: hDate, name: hName.trim() });
      if (res.ok) {
        setHolidays((h) =>
          [...h.filter((x) => x.date !== hDate), { id: `tmp-${hDate}`, date: hDate, name: hName.trim() }].sort((a, z) =>
            a.date.localeCompare(z.date),
          ),
        );
        setHDate('');
        setHName('');
        router.refresh();
      } else {
        toast.error(t('saveError'));
      }
    });
  }

  function removeHoliday(id: string, date: string) {
    setHolidays((h) => h.filter((x) => x.id !== id));
    startHoliday(async () => {
      // tmp- ids belong to optimistic rows a refresh will reconcile; only call
      // the server for persisted rows.
      if (!id.startsWith('tmp-')) await deleteHoliday(id);
      router.refresh();
      void date;
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>

      {/* Weekly hours */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 text-muted-foreground" /> {t('weeklyHours')}
          </div>
          <div className="space-y-2">
            {days.map((label, day) => {
              const dayWindows = windows
                .map((w, i) => ({ w, i }))
                .filter(({ w }) => w.dayOfWeek === day);
              return (
                <div key={day} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                  <span className="w-24 shrink-0 text-sm font-medium">{label}</span>
                  {dayWindows.length === 0 ? (
                    <span className="text-xs text-muted-foreground">{t('closed')}</span>
                  ) : (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      {dayWindows.map(({ w, i }) => (
                        <div key={i} className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2 py-1">
                          <input
                            type="time"
                            value={w.startTime}
                            onChange={(e) => updateWindow(i, { startTime: e.target.value })}
                            dir="ltr"
                            className="bg-transparent text-sm outline-none"
                            aria-label={t('from')}
                          />
                          <span className="text-xs text-muted-foreground">–</span>
                          <input
                            type="time"
                            value={w.endTime}
                            onChange={(e) => updateWindow(i, { endTime: e.target.value })}
                            dir="ltr"
                            className="bg-transparent text-sm outline-none"
                            aria-label={t('to')}
                          />
                          <button
                            onClick={() => removeWindow(i)}
                            aria-label={tc('delete')}
                            className="text-muted-foreground transition hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => addWindow(day)}
                    className="ms-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition hover:bg-accent"
                  >
                    <Plus className="size-3" /> {t('addWindow')}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('inheritNote')}</p>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="me-1 size-4 animate-spin" />}
            {t('save')}
          </Button>
        </CardContent>
      </Card>

      {/* Holidays */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarOff className="size-4 text-muted-foreground" /> {t('holidays')}
          </div>
          <p className="text-xs text-muted-foreground">{t('holidaysHint')}</p>

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('from')}</Label>
              <Input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} dir="ltr" className="w-40" />
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <Label className="text-xs">{t('holidayName')}</Label>
              <Input value={hName} onChange={(e) => setHName(e.target.value)} placeholder={t('holidayName')} />
            </div>
            <Button variant="outline" onClick={submitHoliday} disabled={addingHoliday || !hDate || !hName.trim()}>
              {addingHoliday ? <Loader2 className="me-1 size-4 animate-spin" /> : <Plus className="me-1 size-4" />}
              {t('addHoliday')}
            </Button>
          </div>

          {holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('noHolidays')}</p>
          ) : (
            <div className="divide-y">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center gap-3 py-2">
                  <span className="w-28 shrink-0 text-sm tabular-nums" dir="ltr">{h.date}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{h.name}</span>
                  <button
                    onClick={() => removeHoliday(h.id, h.date)}
                    aria-label={tc('delete')}
                    className="text-muted-foreground transition hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
