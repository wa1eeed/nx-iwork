'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Plus, Loader2, Trash2, Clock, Power } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { createSchedule, toggleSchedule, deleteSchedule } from '@/lib/actions/schedules';
import { useConfirm } from '@/components/ui/confirm-dialog';

export interface ScheduleRow {
  id: string;
  name: string;
  taskTemplate: string;
  cronExpression: string;
  isActive: boolean;
  nextRunAt: string | null;
  runCount: number;
}

type Freq = 'hourly' | 'daily' | 'weekly';

// Turn the friendly picker into a 5-field cron expression.
function toCron(freq: Freq, hour: number, day: number): string {
  if (freq === 'hourly') return '0 * * * *';
  if (freq === 'daily') return `0 ${hour} * * *`;
  return `0 ${hour} * * ${day}`;
}

const selectCls = 'h-10 rounded-md border border-input bg-background px-3 text-sm';

export function AgentSchedules({
  agentId,
  schedules,
  timezone,
}: {
  agentId: string;
  schedules: ScheduleRow[];
  timezone: string;
}) {
  const t = useTranslations('agentSchedules');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const locale = useLocale();
  const DAYS = t.raw('days') as string[];
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [taskTemplate, setTaskTemplate] = useState('');
  const [freq, setFreq] = useState<Freq>('daily');
  const [hour, setHour] = useState(9);
  const [day, setDay] = useState(0);
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim()) return toast.error(t('nameRequired'));
    if (!taskTemplate.trim()) return toast.error(t('taskRequired'));
    start(async () => {
      const res = await createSchedule(agentId, {
        name: name.trim(),
        taskTemplate: taskTemplate.trim(),
        cronExpression: toCron(freq, hour, day),
        timezone,
        isActive: true,
      });
      if (res.ok) {
        toast.success(t('added'));
        setName('');
        setTaskTemplate('');
        setAdding(false);
        router.refresh();
      } else {
        toast.error(res.error === 'bad_cron' ? t('badCron') : t('addError'));
      }
    });
  }

  function toggle(id: string, isActive: boolean) {
    start(async () => {
      const res = await toggleSchedule(id, isActive);
      if (res.ok) router.refresh();
      else toast.error(t('updateError'));
    });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: t('confirmDelete'), destructive: true, confirmLabel: tc('delete'), cancelLabel: tc('cancel') }))) return;
    start(async () => {
      const res = await deleteSchedule(id);
      if (res.ok) {
        toast.success(t('deleted'));
        router.refresh();
      } else {
        toast.error(t('deleteError'));
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t('title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="me-1 h-4 w-4" />
              {t('schedule')}
            </Button>
          )}
        </div>

        {adding && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>{t('nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('taskLabel')}</Label>
              <Textarea
                rows={2}
                value={taskTemplate}
                onChange={(e) => setTaskTemplate(e.target.value)}
                placeholder={t('taskPlaceholder')}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('frequency')}</Label>
                <select className={selectCls} value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
                  <option value="hourly">{t('freqHourly')}</option>
                  <option value="daily">{t('freqDaily')}</option>
                  <option value="weekly">{t('freqWeekly')}</option>
                </select>
              </div>
              {freq === 'weekly' && (
                <div className="space-y-1">
                  <Label className="text-xs">{t('dayLabel')}</Label>
                  <select className={selectCls} value={day} onChange={(e) => setDay(Number(e.target.value))}>
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {freq !== 'hourly' && (
                <div className="space-y-1">
                  <Label className="text-xs">{t('hourLabel')}</Label>
                  <select className={selectCls} value={hour} onChange={(e) => setHour(Number(e.target.value))}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={pending}>
                {t('cancel')}
              </Button>
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {schedules.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          )}
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span dir="ltr">{s.cronExpression}</span> · {t('runCount', { count: s.runCount })}
                  {s.nextRunAt ? t('nextRun', { date: new Date(s.nextRunAt).toLocaleString(locale) }) : ''}
                </p>
              </div>
              <span title={s.isActive ? t('active') : t('inactive')}>
                <Power className={s.isActive ? 'h-4 w-4 text-emerald-500' : 'h-4 w-4 text-muted-foreground'} />
              </span>
              <Switch checked={s.isActive} onCheckedChange={(c) => toggle(s.id, c)} disabled={pending} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(s.id)}
                className="text-destructive hover:text-destructive"
                aria-label={tc('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
