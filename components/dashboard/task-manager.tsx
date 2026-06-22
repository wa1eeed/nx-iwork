'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  PENDING: { label: 'قيد الانتظار', cls: 'text-muted-foreground', icon: Clock },
  WORKING: { label: 'يعمل الآن', cls: 'text-amber-500', icon: Loader2 },
  DONE: { label: 'منجز', cls: 'text-emerald-500', icon: CheckCircle2 },
  FAILED: { label: 'فشل', cls: 'text-destructive', icon: XCircle },
  CANCELLED: { label: 'ملغى', cls: 'text-muted-foreground', icon: XCircle },
};

const IN_PROGRESS = new Set(['PENDING', 'WORKING', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'BLOCKED']);
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

function fmt(iso: string | null): string {
  if (!iso) return '';
  return formatDateTime(iso, 'ar', { dateStyle: 'medium', timeStyle: 'short' });
}

export function TaskManager({
  tasks,
  schedules,
  agents,
}: {
  tasks: TaskRow[];
  schedules: ScheduleRow[];
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [priority, setPriority] = useState('MEDIUM');
  const [saving, startSave] = useTransition();
  const [runningId, setRunningId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const inProgress = tasks.filter((t) => IN_PROGRESS.has(t.status));
  const done = tasks.filter((t) => !IN_PROGRESS.has(t.status));

  function submit() {
    if (!title.trim()) return toast.error('عنوان المهمة مطلوب.');
    if (!agentId) return toast.error('اختر الموظف المسؤول.');
    startSave(async () => {
      const res = await createTask({
        title: title.trim(),
        description: description.trim(),
        agentId,
        kind: 'AGENT_TASK',
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      });
      if (res.ok) {
        feedback('scheduled', 'تمت إضافة المهمة لقائمة المهام.');
        setTitle('');
        setDescription('');
        setAdding(false);
        router.refresh();
      } else {
        feedback('error', 'تعذّرت الإضافة.');
      }
    });
  }

  async function run(id: string) {
    setRunningId(id);
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) feedback('success', 'نفّذ الموظف المهمة بنجاح.');
      else if (data.reason === 'billing_limit') feedback('approval', 'انتهى رصيد التوكنز — جدّد باقتك.');
      else if (data.reason === 'vertex_not_configured') feedback('error', 'خدمة الذكاء غير مهيأة.');
      else feedback('error', 'تعذّر تنفيذ المهمة.');
    } catch {
      feedback('error', 'فشل الاتصال بالخادم.');
    } finally {
      setRunningId(null);
      router.refresh();
    }
  }

  function remove(id: string) {
    if (!window.confirm('حذف هذه المهمة؟')) return;
    startSave(async () => {
      const res = await deleteTask(id);
      if (res.ok) {
        toast.success('تم الحذف.');
        router.refresh();
      } else {
        toast.error('تعذّر الحذف.');
      }
    });
  }

  function TaskCard({ t, showRun }: { t: TaskRow; showRun: boolean }) {
    const st = STATUS[t.status] ?? STATUS.PENDING;
    const StIcon = st.icon;
    const busy = runningId === t.id || t.status === 'WORKING';
    return (
      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.agentName ?? 'بدون موظف'} ·{' '}
                <span className={cn('inline-flex items-center gap-1', st.cls)}>
                  <StIcon className={cn('h-3 w-3', busy && 'animate-spin')} />
                  {busy ? 'يعمل الآن' : st.label}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                أُنشئت: {fmt(t.createdAt)}
                {t.completedAt ? ` · انتهت: ${fmt(t.completedAt)}` : ''}
              </p>
            </div>
            {showRun && t.kind === 'AGENT_TASK' && (
              <Button size="sm" onClick={() => run(t.id)} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ms-1">تشغيل</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(t.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {t.result && (
            <div>
              <button
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn('h-3 w-3 transition', openId === t.id && 'rotate-180')} />
                نتيجة التنفيذ
              </button>
              {openId === t.id && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{t.result}</p>
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
          مهمة جديدة
        </Button>
      )}
      {agents.length === 0 && (
        <p className="text-sm text-muted-foreground">أنشئ موظفاً أولاً لتكليفه بمهام.</p>
      )}

      {adding && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>عنوان المهمة *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثل: اكتب 3 منشورات تسويقية" />
            </div>
            <div className="space-y-2">
              <Label>التفاصيل</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وضّح المطلوب بدقة." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>الموظف المسؤول *</Label>
                <select className={selectCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>الأولوية</Label>
                <select className={selectCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="LOW">منخفضة</option>
                  <option value="MEDIUM">متوسطة</option>
                  <option value="HIGH">عالية</option>
                  <option value="URGENT">عاجلة</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>إلغاء</Button>
              <Button onClick={submit} disabled={saving}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                إضافة المهمة
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">قيد التنفيذ ({inProgress.length})</TabsTrigger>
          <TabsTrigger value="done">منجزة ({done.length})</TabsTrigger>
          <TabsTrigger value="scheduled">مجدولة ({schedules.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {inProgress.length === 0
            ? empty('لا مهام قيد التنفيذ.')
            : inProgress.map((t) => <TaskCard key={t.id} t={t} showRun />)}
        </TabsContent>

        <TabsContent value="done" className="space-y-3">
          {done.length === 0
            ? empty('لا مهام منجزة بعد.')
            : done.map((t) => <TaskCard key={t.id} t={t} showRun={false} />)}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-3">
          {schedules.length === 0
            ? empty('لا مهام مجدولة. أضف جدولة من بروفايل الموظف.')
            : schedules.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.agentName ?? '—'} · نُفّذت {s.runCount} مرة
                        {s.nextRunAt ? ` · التالي ${fmt(s.nextRunAt)}` : ''}
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
