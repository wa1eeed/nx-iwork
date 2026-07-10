'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Plus,
  Play,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarClock,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Countdown } from '@/components/dashboard/countdown';
import { feedback } from '@/lib/ui/feedback';
import { createTask, deleteTask } from '@/lib/actions/tasks';
import { useConfirm } from '@/components/ui/confirm-dialog';

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  kind: string;
  priority: string;
  agentName: string | null;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ScheduleRow {
  id: string;
  name: string;
  agentName: string | null;
  cronExpression: string;
  nextRunAt: string | null;
  runCount: number;
}

const STATUS: Record<string, { labelKey: string; cls: string; icon: typeof Clock }> = {
  PENDING: { labelKey: 'statusPending', cls: 'text-muted-foreground', icon: Clock },
  WORKING: { labelKey: 'statusWorking', cls: 'text-amber-500', icon: Loader2 },
  DONE: { labelKey: 'statusDone', cls: 'text-emerald-500', icon: CheckCircle2 },
  FAILED: { labelKey: 'statusFailed', cls: 'text-destructive', icon: XCircle },
  CANCELLED: { labelKey: 'statusCancelled', cls: 'text-muted-foreground', icon: XCircle },
};

const IN_PROGRESS = new Set(['PENDING', 'WORKING', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'BLOCKED']);
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function TaskManager({
  tasks,
  schedules,
  agents,
}: {
  tasks: TaskRow[];
  schedules: ScheduleRow[];
  agents: { id: string; name: string }[];
}) {
  const t = useTranslations('taskMgr');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const locale = useLocale();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [priority, setPriority] = useState('MEDIUM');
  const [saving, startSave] = useTransition();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  function fmt(iso: string | null): string {
    if (!iso) return '';
    return formatDateTime(iso, locale, { dateStyle: 'medium', timeStyle: 'short' });
  }

  const inProgress = tasks.filter((task) => IN_PROGRESS.has(task.status));
  const done = tasks.filter((task) => !IN_PROGRESS.has(task.status));

  function submit() {
    if (!title.trim()) return toast.error(t('titleRequired'));
    if (!agentId) return toast.error(t('agentRequired'));
    startSave(async () => {
      const res = await createTask({
        title: title.trim(),
        description: description.trim(),
        agentId,
        kind: 'AGENT_TASK',
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      });
      if (res.ok) {
        feedback('scheduled', t('added'));
        setTitle('');
        setDescription('');
        setAdding(false);
        router.refresh();
      } else {
        feedback('error', t('addError'));
      }
    });
  }

  async function run(id: string) {
    setRunningId(id);
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) feedback('success', t('runSuccess'));
      else if (data.reason === 'billing_limit') feedback('approval', t('runBillingLimit'));
      else if (data.reason === 'vertex_not_configured') feedback('error', t('runVertexError'));
      else feedback('error', t('runError'));
    } catch {
      feedback('error', t('connectError'));
    } finally {
      setRunningId(null);
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: t('confirmDelete'), destructive: true, confirmLabel: tc('delete'), cancelLabel: tc('cancel') }))) return;
    startSave(async () => {
      const res = await deleteTask(id);
      if (res.ok) {
        toast.success(t('deleted'));
        router.refresh();
      } else {
        toast.error(t('deleteError'));
      }
    });
  }

  function TaskCard({ task, showRun }: { task: TaskRow; showRun: boolean }) {
    const st = STATUS[task.status] ?? STATUS.PENDING;
    const StIcon = st.icon;
    const busy = runningId === task.id || task.status === 'WORKING';
    return (
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {task.agentName ?? t('noAgent')} ·{' '}
                <span className={cn('inline-flex items-center gap-1', st.cls)}>
                  <StIcon className={cn('h-3 w-3', busy && 'animate-spin')} />
                  {busy ? t('statusWorking') : t(st.labelKey)}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('createdAt', { date: fmt(task.createdAt) })}
                {task.completedAt ? t('completedAt', { date: fmt(task.completedAt) }) : ''}
              </p>
            </div>
            {showRun && task.kind === 'AGENT_TASK' && (
              <Button size="sm" onClick={() => run(task.id)} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ms-1">{t('run')}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(task.id)}
              className="text-destructive hover:text-destructive"
              aria-label={tc('delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {task.result && (
            <div>
              <button
                onClick={() => setOpenId(openId === task.id ? null : task.id)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn('h-3 w-3 transition', openId === task.id && 'rotate-180')} />
                {t('result')}
              </button>
              {openId === task.id && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{task.result}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  function empty(text: string) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
  }

  return (
    <div className="space-y-4">
      {!adding && (
        <Button onClick={() => setAdding(true)} disabled={agents.length === 0}>
          <Plus className="me-1 h-4 w-4" />
          {t('newTask')}
        </Button>
      )}
      {agents.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('createFirstAgent')}</p>
      )}

      {adding && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>{t('titleLabel')}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('detailsLabel')}</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('detailsPlaceholder')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('agentLabel')}</Label>
                <select className={selectCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t('priorityLabel')}</Label>
                <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="LOW">{t('priorityLow')}</option>
                  <option value="MEDIUM">{t('priorityMedium')}</option>
                  <option value="HIGH">{t('priorityHigh')}</option>
                  <option value="URGENT">{t('priorityUrgent')}</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>{t('cancel')}</Button>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {t('addTask')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t('tabActive', { count: inProgress.length })}</TabsTrigger>
          <TabsTrigger value="done">{t('tabDone', { count: done.length })}</TabsTrigger>
          <TabsTrigger value="scheduled">{t('tabScheduled', { count: schedules.length })}</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {inProgress.length === 0
            ? empty(t('emptyActive'))
            : inProgress.map((task) => <TaskCard key={task.id} task={task} showRun />)}
        </TabsContent>

        <TabsContent value="done" className="space-y-3">
          {done.length === 0
            ? empty(t('emptyDone'))
            : done.map((task) => <TaskCard key={task.id} task={task} showRun={false} />)}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-3">
          {schedules.length === 0
            ? empty(t('emptyScheduled'))
            : schedules.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.agentName ?? '—'} · {t('runCount', { count: s.runCount })}
                        {s.nextRunAt ? t('nextRun', { date: fmt(s.nextRunAt) }) : ''}
                      </p>
                    </div>
                    {s.nextRunAt && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs">
                        <Countdown target={s.nextRunAt} />
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
