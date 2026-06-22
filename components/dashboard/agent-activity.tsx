'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CalendarClock,
  ChevronDown,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';
import { Countdown } from '@/components/dashboard/countdown';

export interface AgentTaskRow {
  id: string;
  title: string;
  status: string;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AgentScheduleRow {
  id: string;
  name: string;
  nextRunAt: string | null;
  runCount: number;
}

const STATUS: Record<string, { label: string; dot: string; text: string; icon: typeof Clock }> = {
  PENDING: { label: 'قيد الانتظار', dot: 'bg-muted-foreground', text: 'text-muted-foreground', icon: Clock },
  WORKING: { label: 'يعمل الآن', dot: 'bg-amber-500', text: 'text-amber-500', icon: Loader2 },
  DONE: { label: 'منجز', dot: 'bg-emerald-500', text: 'text-emerald-500', icon: CheckCircle2 },
  FAILED: { label: 'فشل', dot: 'bg-destructive', text: 'text-destructive', icon: XCircle },
  CANCELLED: { label: 'ملغى', dot: 'bg-muted-foreground', text: 'text-muted-foreground', icon: XCircle },
};

const IN_PROGRESS = new Set(['PENDING', 'WORKING', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'BLOCKED']);

function fmt(iso: string | null): string {
  if (!iso) return '';
  return formatDateTime(iso, 'ar', { dateStyle: 'medium', timeStyle: 'short' });
}

// Live activity timeline for one agent. Auto-refreshes so running tasks update
// without a manual reload.
export function AgentActivity({
  tasks,
  schedules,
}: {
  tasks: AgentTaskRow[];
  schedules: AgentScheduleRow[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  // Live: pull fresh server data every 15s (cheap; cards re-render in place).
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(id);
  }, [router]);

  const inProgress = tasks.filter((t) => IN_PROGRESS.has(t.status));
  const done = tasks.filter((t) => !IN_PROGRESS.has(t.status));

  function empty(text: string) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
  }

  // A vertical-timeline row: dot on a line + content.
  function TaskNode({ t, last }: { t: AgentTaskRow; last: boolean }) {
    const st = STATUS[t.status] ?? STATUS.PENDING;
    const StIcon = st.icon;
    const busy = t.status === 'WORKING';
    return (
      <div className="relative flex gap-3 ps-2">
        {/* line */}
        {!last && <span className="absolute start-[10px] top-5 h-full w-px bg-border" />}
        {/* dot */}
        <span className={cn('relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-background', st.dot, busy && 'animate-pulse')} />
        <div className="min-w-0 flex-1 pb-5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">{t.title}</p>
            <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs', st.text)}>
              <StIcon className={cn('h-3 w-3', busy && 'animate-spin')} />
              {st.label}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
            أُنشئت: {fmt(t.createdAt)}
            {t.completedAt ? ` · انتهت: ${fmt(t.completedAt)}` : ''}
          </p>
          {t.result && (
            <div className="mt-1">
              <button
                onClick={() => setOpenId(openId === t.id ? null : t.id)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn('h-3 w-3 transition', openId === t.id && 'rotate-180')} />
                نتيجة التنفيذ
              </button>
              {openId === t.id && (
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{t.result}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">قيد التنفيذ ({inProgress.length})</TabsTrigger>
        <TabsTrigger value="done">منجزة ({done.length})</TabsTrigger>
        <TabsTrigger value="scheduled">مجدولة ({schedules.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="pt-3">
        {inProgress.length === 0
          ? empty('لا مهام قيد التنفيذ.')
          : inProgress.map((t, i) => <TaskNode key={t.id} t={t} last={i === inProgress.length - 1} />)}
      </TabsContent>

      <TabsContent value="done" className="pt-3">
        {done.length === 0
          ? empty('لا مهام منجزة بعد.')
          : done.map((t, i) => <TaskNode key={t.id} t={t} last={i === done.length - 1} />)}
      </TabsContent>

      <TabsContent value="scheduled" className="space-y-3 pt-3">
        {schedules.length === 0
          ? empty('لا جدولة لهذا الموظف. أضفها من تبويب الإعدادات.')
          : schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    نُفّذت {s.runCount} مرة{s.nextRunAt ? ` · التالي ${fmt(s.nextRunAt)}` : ''}
                  </p>
                </div>
                {s.nextRunAt && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs">
                    <Countdown target={s.nextRunAt} />
                  </span>
                )}
              </div>
            ))}
      </TabsContent>
    </Tabs>
  );
}
