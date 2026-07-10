'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BellRing, MailCheck, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { updateReminders } from '@/lib/actions/settings';

interface RemindersState {
  bookingConfirmationEnabled: boolean;
  bookingReminderEnabled: boolean;
  bookingReminderHoursBefore: number;
}

const HOUR_CHOICES = [1, 2, 3, 6, 12, 24, 48, 72];

export function RemindersTab({ initial }: { initial: RemindersState }) {
  const t = useTranslations('reminders');
  const [form, setForm] = useState<RemindersState>(initial);
  const [saving, startSave] = useTransition();

  function set<K extends keyof RemindersState>(k: K, v: RemindersState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function save() {
    startSave(async () => {
      const res = await updateReminders(form);
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>

      <Card>
        <CardContent className="space-y-5 p-5">
          {/* Confirmation */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <div>
                <Label className="text-sm font-medium">{t('confirmationLabel')}</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('confirmationHint')}</p>
              </div>
            </div>
            <Switch
              checked={form.bookingConfirmationEnabled}
              onCheckedChange={(v) => set('bookingConfirmationEnabled', v)}
            />
          </div>

          <div className="border-t" />

          {/* Reminder */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div>
                <Label className="text-sm font-medium">{t('reminderLabel')}</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('reminderHint')}</p>
              </div>
            </div>
            <Switch
              checked={form.bookingReminderEnabled}
              onCheckedChange={(v) => set('bookingReminderEnabled', v)}
            />
          </div>

          {form.bookingReminderEnabled && (
            <div className="ms-7 space-y-1.5">
              <Label className="text-xs">{t('hoursBefore')}</Label>
              <select
                value={form.bookingReminderHoursBefore}
                onChange={(e) => set('bookingReminderHoursBefore', Number(e.target.value))}
                className="w-full max-w-xs rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {HOUR_CHOICES.map((h) => (
                  <option key={h} value={h}>{t('hoursOption', { count: h })}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{t('channelNote')}</span>
          </div>

          <Button onClick={save} disabled={saving}>{t('save')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
