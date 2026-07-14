'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Play,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Hourglass,
  CircleDot,
  ListChecks,
  CalendarClock,
  Coins,
  Repeat,
  Link2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  agentName: string | null;
  tokensUsed: number;
  attempts: number;
  result: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  dependsOn: { title: string; status: string }[];
}

export interface ScheduleRow {
  id: string;
  name: string;
  cronExpression: string;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  agentName: string | null;
}

export interface CalendarEvent {
  day: string; // YYYY-MM-DD in business tz
  time: string; // localized HH:mm
  at: string; // ISO instant
  title: string;
  agentName: string | null;
  type: 'schedule' | 'task';
  taskId?: string;
  status?: string;
}

// Per-status visual language, shared by the queue pills and the filter chips.
const STATUS: Record<string, { cls: string; dot: string; icon: typeof Clock }> = {
  PENDING: { cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', icon: Clock },
  WORKING: { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', icon: Loader2 },
  PENDING_APPROVAL: { cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', dot: 'bg-violet-500', icon: Hourglass },
  PENDING_REVIEW: { cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', dot: 'bg-blue-500', icon: Hourglass },
  BLOCKED: { cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', icon: Ban },
  DONE: { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', icon: CheckCircle2 },
  FAILED: { cls: 'bg-destructive/10 text-destructive', dot: 'bg-destructive', icon: XCircle },
  CANCELLED: { cls: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', icon: XCircle },
};

// Statuses a task can be (re)started from — mirrors the claim guard in task.ts.
const RUNNABLE = new Set(['PENDING', 'FAILED', 'BLOCKED', 'DONE']);

function StatusPill({ status }: { status: string }) {
  const t = useTranslations('pages.agentWork');
  const s = STATUS[status] ?? STATUS.PENDING;
  const Icon = s.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>
      <Icon className={cn('size-3', status === 'WORKING' && 'animate-spin')} />
      {t(`status.${status}`)}
    </span>
  );
}

export function AgentWorkView({
  todayKey,
  weekStart,
  statusCounts,
  tasks,
  schedules,
  events,
}: {
  todayKey: string;
  weekStart: string;
  statusCounts: Record<string, number>;
  tasks: TaskRow[];
  schedules: ScheduleRow[];
  events: CalendarEvent[];
}) {
  const t = useTranslations('pages.agentWork');

  return (
    <Tabs defaultValue="queue" className="space-y-4">
      <TabsList>
        <TabsTrigger value="queue" className="gap-1.5">
          <ListChecks className="size-4" />
          {t('tabs.queue')}
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-1.5">
          <CalendarClock className="size-4" />
          {t('tabs.calendar')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="queue">
        <Queue statusCounts={statusCounts} tasks={tasks} />
      </TabsContent>

      <TabsContent value="calendar">
        <CalendarBoard todayKey={todayKey} weekStart={weekStart} events={events} schedules={schedules} />
      </TabsContent>
    </Tabs>
  );
}

// ── Queue ──────────────────────────────────────────────────────────────────
function Queue({ statusCounts, tasks }: { statusCounts: Record<string, number>; tasks: TaskRow[] }) {
  const t = useTranslations('pages.agentWork');
  const [filter, setFilter] = useState<string | null>(null);

  const total = tasks.length;
  const present = Object.keys(STATUS).filter((s) => statusCounts[s]);
  const visible = filter ? tasks.filter((tk) => tk.status === filter) : tasks;

  return (
    <div className="space-y-4">
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === null} onClick={() => setFilter(null)} label={t('filterAll')} count={total} />
        {present.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={t(`status.${s}`)}
            count={statusCounts[s]}
            dot={STATUS[s].dot}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('emptyQueue')}</p>
      ) : (
        <div className="space-y-2">
          {visible.map((tk) => (
            <TaskCard key={tk.id} task={tk} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50'
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dot)} />}
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function TaskCard({ task }: { task: TaskRow }) {
  const t = useTranslations('pages.agentWork');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, startRun] = useTransition();

  const runNow = () => {
    startRun(async () => {
      try {
        const res = await fetch(`/api/tasks/${task.id}/run`, { method: 'POST' });
        if (!res.ok) throw new Error(String(res.status));
        toast.success(t('runQueued'));
        router.refresh();
      } catch {
        toast.error(t('runFailed'));
      }
    });
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={task.status} />
              <p className="font-medium">{task.title}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {task.agentName ?? t('noAgent')}
              {' · '}
              {formatDateTime(task.createdAt, locale)}
              {task.attempts > 0 && ` · ${t('attemptsN', { count: task.attempts })}`}
              {task.tokensUsed > 0 && ` · ${task.tokensUsed.toLocaleString(locale)} ${t('tokens')}`}
            </p>
            {task.dependsOn.length > 0 && (
              <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                <Link2 className="size-3" />
                {t('dependsOn')}:
                {task.dependsOn.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className={cn('size-1.5 rounded-full', (STATUS[d.status] ?? STATUS.PENDING).dot)} />
                    {d.title}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {RUNNABLE.has(task.status) && (
              <Button size="sm" variant="ghost" onClick={runNow} disabled={running} className="gap-1">
                {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                <span className="hidden sm:inline">{running ? t('running') : t('runNow')}</span>
              </Button>
            )}
            {(task.result || task.startedAt || task.completedAt || task.dueAt) && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {t('details')}
                <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
              </button>
            )}
          </div>
        </div>

        {task.status === 'WORKING' && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.max(5, task.progress)}%` }} />
          </div>
        )}

        {open && (
          <div className="mt-3 space-y-2 border-t pt-3 text-xs text-muted-foreground">
            <div className="grid gap-1 sm:grid-cols-2">
              {task.dueAt && <Meta label={t('col.due')} value={formatDateTime(task.dueAt, locale)} />}
              {task.startedAt && <Meta label={t('col.started')} value={formatDateTime(task.startedAt, locale)} />}
              {task.completedAt && <Meta label={t('col.completed')} value={formatDateTime(task.completedAt, locale)} />}
            </div>
            {task.result && (
              <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-foreground">{task.result}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="opacity-70">{label}: </span>
      {value}
    </p>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────
function CalendarBoard({
  todayKey,
  weekStart,
  events,
  schedules,
}: {
  todayKey: string;
  weekStart: string;
  events: CalendarEvent[];
  schedules: ScheduleRow[];
}) {
  const t = useTranslations('pages.agentWork');
  const locale = useLocale();

  const [ty, tm] = todayKey.split('-').map(Number); // today's year, month (1-based)
  const [view, setView] = useState({ y: ty, m: tm - 1 }); // m: 0-based
  const [selected, setSelected] = useState<string>(todayKey);

  const startIndex = weekStart === 'monday' ? 1 : weekStart === 'saturday' ? 6 : 0;

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = map.get(e.day) ?? [];
      arr.push(e);
      map.set(e.day, arr);
    }
    return map;
  }, [events]);

  // Build a 6×7 grid whose day-keys are tz-independent (UTC construction).
  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const lead = (firstWeekday - startIndex + 7) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(Date.UTC(view.y, view.m, 1 + i - lead));
      return {
        key: dt.toISOString().slice(0, 10),
        dayNum: dt.getUTCDate(),
        inMonth: dt.getUTCMonth() === view.m,
      };
    });
  }, [view, startIndex]);

  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', timeZone: 'UTC' });
    // 2024-09-01 is a Sunday — rotate from the configured week start.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 8, 1 + ((startIndex + i) % 7)))));
  }, [locale, startIndex]);

  const monthLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(view.y, view.m, 1)));

  const shift = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  };

  const dayEvents = byDay.get(selected) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Month grid */}
      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold capitalize">{monthLabel}</h3>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label={t('calendar.prev')}>
                <ChevronLeft className="size-4 rtl:rotate-180" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setView({ y: ty, m: tm - 1 }); setSelected(todayKey); }}>
                {t('calendar.today')}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label={t('calendar.next')}>
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {weekdayNames.map((w, i) => (
              <div key={i} className="pb-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c) => {
              const evs = byDay.get(c.key) ?? [];
              const isToday = c.key === todayKey;
              const isSel = c.key === selected;
              return (
                <button
                  key={c.key}
                  onClick={() => setSelected(c.key)}
                  className={cn(
                    'flex min-h-[62px] flex-col rounded-lg border p-1 text-start transition-colors',
                    c.inMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground',
                    isSel ? 'border-primary/50 ring-1 ring-primary/30' : 'border-transparent hover:border-border'
                  )}
                >
                  <span
                    className={cn(
                      'mb-0.5 inline-flex size-5 items-center justify-center rounded-full text-xs',
                      isToday && 'bg-primary font-semibold text-primary-foreground'
                    )}
                  >
                    {c.dayNum}
                  </span>
                  <span className="space-y-0.5">
                    {evs.slice(0, 2).map((e, i) => (
                      <span
                        key={i}
                        className={cn(
                          'block truncate rounded px-1 text-[10px] leading-tight',
                          e.type === 'schedule' ? 'bg-primary/10 text-primary' : 'bg-accent text-accent-foreground'
                        )}
                      >
                        {e.time} {e.title}
                      </span>
                    ))}
                    {evs.length > 2 && (
                      <span className="block px-1 text-[10px] text-muted-foreground">
                        {t('calendar.more', { count: evs.length - 2 })}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Right rail: selected-day agenda + recurring schedules */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm font-semibold">{t('calendar.agenda')}</h3>
            {dayEvents.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">{t('calendar.noEvents')}</p>
            ) : (
              <ul className="space-y-2">
                {dayEvents.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={cn('mt-0.5 shrink-0', e.type === 'schedule' ? 'text-primary' : 'text-muted-foreground')}>
                      {e.type === 'schedule' ? <Repeat className="size-3.5" /> : <CircleDot className="size-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.time}
                        {e.agentName && ` · ${e.agentName}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Repeat className="size-4 text-primary" />
              {t('schedules.title')}
            </h3>
            {schedules.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">{t('schedules.none')}</p>
            ) : (
              <ul className="space-y-3">
                {schedules.map((s) => (
                  <li key={s.id} className="space-y-1 border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">{s.cronExpression}</code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.agentName ?? t('noAgent')}
                      {' · '}
                      {t('schedules.runs', { count: s.runCount })}
                    </p>
                    {s.nextRunAt && (
                      <p className="text-xs text-muted-foreground">
                        <Clock className="me-1 inline size-3" />
                        {t('schedules.nextRun')}: {formatDateTime(s.nextRunAt, locale)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
