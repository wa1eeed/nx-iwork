'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { createTrigger, toggleTrigger, deleteTrigger } from '@/lib/actions/knowledge';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { TRIGGER_EVENTS } from '@/lib/agent/events-catalog';
import type { TriggerInput } from '@/lib/validators/knowledge';

export interface TriggerRow {
  id: string;
  event: string;
  name: string;
  agentName: string | null;
  isActive: boolean;
  fireCount: number;
}

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

// Company-wide trigger editor. Events come from the shared TRIGGER_EVENTS
// catalog (labels in `events.*`) so all trigger UIs offer the same vocabulary.
export function TriggerManager({
  triggers,
  agents,
}: {
  triggers: TriggerRow[];
  agents: { id: string; name: string }[];
}) {
  const t = useTranslations('triggerMgr');
  const te = useTranslations('events');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [event, setEvent] = useState<TriggerInput['event']>('LEAD_CREATED');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [name, setName] = useState('');
  const [taskTemplate, setTaskTemplate] = useState('');
  const [saving, start] = useTransition();

  function save() {
    if (!name.trim()) return toast.error(t('nameRequired'));
    if (!agentId) return toast.error(t('agentRequired'));
    if (!taskTemplate.trim()) return toast.error(t('taskRequired'));
    start(async () => {
      const res = await createTrigger({
        event,
        agentId,
        name: name.trim(),
        taskTemplate: taskTemplate.trim(),
        isActive: true,
      });
      if (res.ok) {
        toast.success(t('added'));
        setName('');
        setTaskTemplate('');
        setAdding(false);
        router.refresh();
      } else toast.error(t('addError'));
    });
  }

  function toggle(id: string, isActive: boolean) {
    start(async () => {
      const res = await toggleTrigger(id, isActive);
      if (res.ok) router.refresh();
      else toast.error(t('updateError'));
    });
  }

  async function remove(id: string) {
    if (!(await confirm({ title: t('confirmDelete'), destructive: true, confirmLabel: tc('delete'), cancelLabel: tc('cancel') }))) return;
    start(async () => {
      const res = await deleteTrigger(id);
      if (res.ok) {
        toast.success(t('deleted'));
        router.refresh();
      } else toast.error(t('deleteError'));
    });
  }

  return (
    <div className="space-y-3">
      {!adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={agents.length === 0}>
          <Plus className="me-1 h-4 w-4" />
          {t('newTrigger')}
        </Button>
      )}
      {agents.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('createFirstAgent')}</p>
      )}

      {adding && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t('onEvent')}</Label>
                <select className={selectCls} value={event} onChange={(e) => setEvent(e.target.value as TriggerInput['event'])}>
                  {TRIGGER_EVENTS.map((ev) => (
                    <option key={ev} value={ev}>{te(ev)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('wakesAgent')}</Label>
                <select className={selectCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('nameLabel')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="space-y-1">
              <Label>{t('taskLabel')}</Label>
              <Textarea rows={2} value={taskTemplate} onChange={(e) => setTaskTemplate(e.target.value)} placeholder={t('taskPlaceholder')} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving}>{t('cancel')}</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {triggers.length === 0 && !adding && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}

      {triggers.map((row) => (
        <Card key={row.id}>
          <CardContent className="flex items-center gap-3 p-4">
            <Zap className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {(TRIGGER_EVENTS as string[]).includes(row.event) ? te(row.event) : row.event} → {row.agentName ?? '—'} · {t('fireCount', { count: row.fireCount })}
              </p>
            </div>
            <Switch checked={row.isActive} onCheckedChange={(c) => toggle(row.id, c)} disabled={saving} />
            <Button variant="ghost" size="icon" onClick={() => remove(row.id)} className="text-destructive hover:text-destructive" aria-label={tc('delete')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
