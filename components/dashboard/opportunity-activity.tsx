'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { StickyNote, MapPin, Clock, Users, Loader2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { feedback } from '@/lib/ui/feedback';
import { formatDateTime } from '@/lib/format';
import {
  addCustomerNote,
  addCustomerReminder,
  addCustomerMeeting,
  convertOpportunityToOrder,
} from '@/lib/actions/crm-activity';

export interface ActivityItem {
  id: string;
  kind: 'NOTE' | 'VISIT' | 'REMINDER' | 'MEETING';
  body: string;
  at: string;
  done: boolean;
}

type Form = 'note' | 'visit' | 'reminder' | 'meeting' | null;

const ICONS: Record<ActivityItem['kind'], typeof StickyNote> = {
  NOTE: StickyNote,
  VISIT: MapPin,
  REMINDER: Clock,
  MEETING: Users,
};

export function OpportunityActivity({
  customerId,
  items,
  status,
}: {
  customerId: string;
  items: ActivityItem[];
  status: string;
}) {
  const t = useTranslations('crm');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState<Form>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  const [end, setEnd] = useState('');
  const [pending, start] = useTransition();

  const reset = () => {
    setText('');
    setTitle('');
    setWhen('');
    setEnd('');
    setForm(null);
  };

  const submit = () =>
    start(async () => {
      let res;
      if (form === 'note' || form === 'visit') {
        res = await addCustomerNote(customerId, form === 'note' ? 'NOTE' : 'VISIT', text);
      } else if (form === 'reminder') {
        res = await addCustomerReminder(customerId, title, when);
      } else if (form === 'meeting') {
        res = await addCustomerMeeting(customerId, title, when, end || null);
      } else {
        return;
      }
      if (res?.ok) {
        feedback('success', t('activityAdded'));
        reset();
        router.refresh();
      } else {
        feedback('error', res?.error === 'invalid' ? t('activityInvalid') : t('updateFailed'));
      }
    });

  const convert = () =>
    start(async () => {
      const res = await convertOpportunityToOrder(customerId);
      if (res.ok) {
        feedback('success', t('converted'));
        router.refresh();
      } else {
        feedback('error', t('updateFailed'));
      }
    });

  const actions: { key: Exclude<Form, null>; label: string; icon: typeof StickyNote }[] = [
    { key: 'note', label: t('addNote'), icon: StickyNote },
    { key: 'visit', label: t('addVisit'), icon: MapPin },
    { key: 'reminder', label: t('addReminder'), icon: Clock },
    { key: 'meeting', label: t('addMeeting'), icon: Users },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t('activity')}</p>
          {status !== 'WON' && (
            <Button size="sm" variant="outline" onClick={convert} disabled={pending}>
              <ArrowRightLeft className="me-1 size-3.5" />
              {t('convertToOrder')}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {actions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                reset();
                setForm(key);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                form === key ? 'border-primary bg-gradient-brand-soft text-primary' : 'hover:bg-accent'
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {form && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            {(form === 'note' || form === 'visit') && (
              <Textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={form === 'note' ? t('notePlaceholder') : t('visitPlaceholder')}
              />
            )}
            {(form === 'reminder' || form === 'meeting') && (
              <>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={form === 'reminder' ? t('reminderPlaceholder') : t('meetingPlaceholder')}
                />
                <div className="flex flex-wrap gap-2">
                  <label className="flex-1 space-y-1">
                    <span className="text-xs text-muted-foreground">
                      {form === 'meeting' ? t('startAt') : t('dueAt')}
                    </span>
                    <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} dir="ltr" />
                  </label>
                  {form === 'meeting' && (
                    <label className="flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">{t('endAt')}</span>
                      <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} dir="ltr" />
                    </label>
                  )}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>
                {tc('cancel')}
              </Button>
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending && <Loader2 className="me-1 size-3.5 animate-spin" />}
                {tc('save')}
              </Button>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{t('noActivity')}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const Icon = ICONS[it.kind];
              return (
                <li key={it.id} className="flex gap-3 rounded-lg border p-2.5">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{it.body}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t(`kind.${it.kind}`)} · {formatDateTime(it.at, locale)}
                      {it.done ? ` · ${t('done')}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
