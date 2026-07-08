'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, CalendarClock } from 'lucide-react';
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

export interface AgentApprovalRow {
  id: string;
  decision: string;
}

const DOT: Record<string, string> = {
  PENDING: 'bg-muted-foreground/50',
  WORKING: 'bg-amber-500',
  DONE: 'bg-emerald-500',
  FAILED: 'bg-destructive',
  CANCELLED: 'bg-muted-foreground/40',
};

const IN_PROGRESS = new Set(['PENDING', 'WORKING', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'BLOCKED']);

// The agent's WORK LOG (design View 2 → Activity). A single flat timeline, most
// recent first, with in-progress work floated to the top as "Currently: …".
export function AgentActivity({
  tasks,
  schedules,
  approvals = [],
}: {
  tasks: AgentTaskRow[];
  schedules: AgentScheduleRow[];
  approvals?: AgentApprovalRow[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  // `now` starts null so SSR and first client render agree (no relative times);
  // it fills on mount and ticks every 15s alongside a server refresh.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [router]);

  function rel(iso: string | null): string {
    if (!iso || now === null) return '';
    const m = Math.round((now - new Date(iso).getTime()) / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
  }

  // In-progress first, then by recency.
  const ordered = [...tasks].sort((a, b) => {
    const ai = IN_PROGRESS.has(a.status) ? 1 : 0;
    const bi = IN_PROGRESS.has(b.status) ? 1 : 0;
    if (ai !== bi) return bi - ai;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const nothing = approvals.length === 0 && ordered.length === 0;
  const lastIndex = ordered.length - 1;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Work log
        </p>

        {nothing ? (
          <p className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            No activity yet — this agent hasn&apos;t picked up any work.
          </p>
        ) : (
          <ol className="relative">
            {/* Sensitive decisions the agent paused for — the top of the log. */}
            {approvals.map((a) => (
              <li key={a.id} className="relative flex gap-3 ps-2">
                <span className="absolute start-[10px] top-5 h-full w-px bg-border" />
                <span className="relative mt-1.5 size-2.5 shrink-0 animate-pulse rounded-full bg-amber-500 ring-4 ring-background" />
                <div className="min-w-0 flex-1 pb-5">
                  <p className="text-sm font-medium">
                    Currently: {a.decision} —{' '}
                    <Link
                      href="/approvals"
                      className="text-amber-600 hover:underline dark:text-amber-400"
                    >
                      approve?
                    </Link>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">needs you · just now</p>
                </div>
              </li>
            ))}

            {ordered.map((t, i) => {
              const inProg = IN_PROGRESS.has(t.status);
              const last = i === lastIndex;
              return (
                <li key={t.id} className="relative flex gap-3 ps-2">
                  {!last && <span className="absolute start-[10px] top-5 h-full w-px bg-border" />}
                  <span
                    className={cn(
                      'relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-background',
                      DOT[t.status] ?? DOT.PENDING,
                      t.status === 'WORKING' && 'animate-pulse'
                    )}
                  />
                  <div className="min-w-0 flex-1 pb-5">
                    <p className="text-sm font-medium">
                      {inProg ? `Currently: ${t.title}` : t.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {rel(t.completedAt ?? t.createdAt)}
                    </p>
                    {t.result && (
                      <div className="mt-1">
                        <button
                          onClick={() => setOpenId(openId === t.id ? null : t.id)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ChevronDown
                            className={cn('size-3 transition', openId === t.id && 'rotate-180')}
                          />
                          result
                        </button>
                        {openId === t.id && (
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                            {t.result}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Upcoming scheduled runs. */}
      {schedules.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scheduled
          </p>
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border p-3">
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    ran {s.runCount}×{s.nextRunAt ? '' : ' · inactive'}
                  </p>
                </div>
                {s.nextRunAt && (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px]">
                    <Countdown target={s.nextRunAt} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
