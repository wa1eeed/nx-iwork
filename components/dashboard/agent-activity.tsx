'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  CalendarClock,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
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

const STATUS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  PENDING: { label: 'قيد الانتظار', cls: 'text-muted-foreground', icon: Clock },
  WORKING: { label: 'يعمل الآن', cls: 'text-amber-500', icon: Loader2 },
  DONE: { label: 'منجز', cls: 'text-emerald-500', icon: CheckCircle2 },
  FAILED: { label: 'فشل', cls: 'text-destructive', icon: XCircle },
  CANCELLED: { label: 'ملغى', cls: 'text-muted-foreground', icon: XCircle },
};

const IN_PROGRESS = new Set(['PENDING', 'WORKING', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'BLOCKED']);

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
}

// Read-only activity view for one agent: what it's doing now, what it finished,
// and what's scheduled (with a live countdown to the next run).
export function AgentActivity({
  tasks,
  schedules,
}: {
  tasks: AgentTaskRow[];
  schedules: AgentScheduleRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const inProgress = tasks.filter((t) => IN_PROGRESS.has(t.status));
  const done = tasks.filter((t) => !IN_PROGRESS.has(t.status));

  function empty(text: string) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{text}</p>;
  }

  function card(t: AgentTaskRow) {
    const st = STATUS[t.status] ?? STATUS.PENDING;
    const StIcon = st.icon;
    const busy = t.status === 'WORKING';
    return (
      <Card key={t.id}>
        <CardContent className="space-y-2 p-4">
          <p className="font-medium">{t.title}</p>
          <p className="text-xs text-muted-foreground">
            <span className={cn('inline-flex items-center gap-1', st.cls)}>
              <StIcon className={cn('h-3 w-3', busy && 'animate-spin')} />
              {st.label}
            </span>{' '}
            · أُنشئت: {fmt(t.createdAt)}
            {t.completedAt ? ` · انتهت: ${fmt(t.completedAt)}` : ''}
          </p>
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

  return (
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">قيد التنفيذ ({inProgress.length})</TabsTrigger>
        <TabsTrigger value="done">منجزة ({done.length})</TabsTrigger>
        <TabsTrigger value="scheduled">مجدولة ({schedules.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="space-y-3">
        {inProgress.length === 0 ? empty('لا مهام قيد التنفيذ.') : inProgress.map(card)}
      </TabsContent>

      <TabsContent value="done" className="space-y-3">
        {done.length === 0 ? empty('لا مهام منجزة بعد.') : done.map(card)}
      </TabsContent>

      <TabsContent value="scheduled" className="space-y-3">
        {schedules.length === 0
          ? empty('لا جدولة لهذا الموظف. أضفها من تبويب الإعدادات.')
          : schedules.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      نُفّذت {s.runCount} مرة
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
  );
}
