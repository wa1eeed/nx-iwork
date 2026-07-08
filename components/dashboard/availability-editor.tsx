'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X, CalendarClock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveServiceAvailability } from '@/lib/actions/bookings';

interface Win {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ServiceAvail {
  id: string;
  title: string;
  durationMin: number | null;
  bufferMin: number;
  maxCapacity: number;
  windows: Win[];
}

export function AvailabilityEditor({ services }: { services: ServiceAvail[] }) {
  const t = useTranslations('pages.availability');
  if (services.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('noServices')}</p>;
  }
  return (
    <div className="space-y-4">
      {services.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceAvail }) {
  const t = useTranslations('pages.availability');
  const days = t.raw('days') as string[];
  const [duration, setDuration] = useState(service.durationMin?.toString() ?? '');
  const [buffer, setBuffer] = useState(service.bufferMin.toString());
  const [capacity, setCapacity] = useState(service.maxCapacity.toString());
  const [windows, setWindows] = useState<Win[]>(service.windows);
  const [saving, start] = useTransition();

  const addWindow = (dow: number) =>
    setWindows((w) => [...w, { dayOfWeek: dow, startTime: '09:00', endTime: '17:00' }]);
  const removeWindow = (idx: number) => setWindows((w) => w.filter((_, i) => i !== idx));
  const patchWindow = (idx: number, patch: Partial<Win>) =>
    setWindows((w) => w.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const bookable = duration.trim() !== '' && windows.length > 0;

  const save = () =>
    start(async () => {
      const res = await saveServiceAvailability({
        serviceId: service.id,
        durationMin: duration.trim() === '' ? null : Number(duration),
        bufferMin: Number(buffer || 0),
        maxCapacity: Number(capacity || 1),
        windows,
      });
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{service.title}</span>
          </span>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px]', bookable ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
            {bookable ? t('bookable') : t('notBookable')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('duration')}>
            <Input type="number" min={5} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" dir="ltr" />
          </Field>
          <Field label={t('buffer')}>
            <Input type="number" min={0} value={buffer} onChange={(e) => setBuffer(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('capacity')}>
            <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} dir="ltr" />
          </Field>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">{t('weeklyWindows')}</Label>
          {days.map((label, dow) => {
            const dayWindows = windows.map((w, i) => ({ w, i })).filter(({ w }) => w.dayOfWeek === dow);
            return (
              <div key={dow} className="flex items-start gap-3">
                <div className="w-16 shrink-0 pt-1.5 text-xs font-medium">{label}</div>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {dayWindows.map(({ w, i }) => (
                    <div key={i} className="flex items-center gap-1 rounded-lg border px-2 py-1">
                      <input type="time" value={w.startTime} onChange={(e) => patchWindow(i, { startTime: e.target.value })} className="bg-transparent text-xs outline-none" dir="ltr" />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input type="time" value={w.endTime} onChange={(e) => patchWindow(i, { endTime: e.target.value })} className="bg-transparent text-xs outline-none" dir="ltr" />
                      <button type="button" onClick={() => removeWindow(i)} className="text-muted-foreground hover:text-destructive" aria-label="remove">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addWindow(dow)} className="inline-flex items-center gap-1 rounded-lg border border-dashed px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent">
                    <Plus className="h-3.5 w-3.5" />{t('addWindow')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Check className="me-1 h-4 w-4" />{saving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
