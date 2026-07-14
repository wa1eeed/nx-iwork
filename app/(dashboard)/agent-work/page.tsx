import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { expandOccurrences } from '@/lib/agent/schedule-time';
import { getAutomationHealth } from '@/lib/agent/automation-health';
import { AgentWorkView, type CalendarEvent } from '@/components/dashboard/agent-work-view';
import { AutomationBanner } from '@/components/dashboard/automation-banner';

// How far ahead the scheduled-runs calendar looks. Cron occurrences + dated
// tasks are expanded server-side over this window so the client never ships a
// cron parser or does timezone math.
const CALENDAR_DAYS = 62;

function dayKey(d: Date, tz: string): string {
  // en-CA → YYYY-MM-DD, a stable per-tz day bucket the client grid keys on.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function timeLabel(d: Date, tz: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default async function AgentWorkPage() {
  const t = await getTranslations('pages.agentWork');
  const locale = await getLocale();
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + CALENDAR_DAYS * 24 * 60 * 60 * 1000);

  const [tasks, schedules, datedTasks, settings] = companyId
    ? await Promise.all([
        // Queue — the agent work items, newest first.
        db.task.findMany({
          where: { companyId, kind: 'AGENT_TASK' },
          orderBy: { createdAt: 'desc' },
          take: 150,
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            progress: true,
            dependsOn: true,
            tokensUsed: true,
            result: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            dueAt: true,
            agent: { select: { id: true, name: true } },
            _count: { select: { attempts: true } },
          },
        }),
        // Recurring schedules — the source of the calendar's repeating runs.
        db.agentSchedule.findMany({
          where: { companyId, isActive: true },
          orderBy: { nextRunAt: 'asc' },
          select: {
            id: true,
            name: true,
            cronExpression: true,
            timezone: true,
            nextRunAt: true,
            lastRunAt: true,
            runCount: true,
            agent: { select: { name: true } },
          },
        }),
        // One-off dated work (a task with a due date / reminder) inside the window.
        db.task.findMany({
          where: {
            companyId,
            kind: { in: ['AGENT_TASK', 'REMINDER'] },
            status: { notIn: ['DONE', 'CANCELLED'] },
            OR: [
              { dueAt: { gte: now, lte: windowEnd } },
              { startAt: { gte: now, lte: windowEnd } },
            ],
          },
          take: 200,
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            startAt: true,
            agent: { select: { name: true } },
          },
        }),
        db.businessSettings.findUnique({
          where: { companyId },
          select: { timezone: true, weekStart: true },
        }),
      ])
    : [[], [], [], null];

  const tz = settings?.timezone ?? 'Asia/Riyadh';
  const weekStart = settings?.weekStart ?? 'sunday';
  const health = await getAutomationHealth();

  // Resolve depends-on ids → titles so the chain reads as names, not cuids.
  const depIds = Array.from(new Set(tasks.flatMap((tk) => tk.dependsOn)));
  const depTitles =
    depIds.length && companyId
      ? await db.task.findMany({
          where: { id: { in: depIds }, companyId },
          select: { id: true, title: true, status: true },
        })
      : [];
  const depMap = new Map(depTitles.map((d) => [d.id, d]));

  // Build the calendar: expand each schedule's cron across the window, plus the
  // one-off dated tasks. Everything is bucketed by business-tz day.
  const events: CalendarEvent[] = [];
  for (const s of schedules) {
    const occ = expandOccurrences(s.cronExpression, s.timezone || tz, now, windowEnd);
    for (const d of occ) {
      events.push({
        day: dayKey(d, tz),
        time: timeLabel(d, tz, locale),
        at: d.toISOString(),
        title: s.name,
        agentName: s.agent?.name ?? null,
        type: 'schedule',
      });
    }
  }
  for (const dt of datedTasks) {
    const when = dt.dueAt ?? dt.startAt;
    if (!when) continue;
    events.push({
      day: dayKey(when, tz),
      time: timeLabel(when, tz, locale),
      at: when.toISOString(),
      title: dt.title,
      agentName: dt.agent?.name ?? null,
      type: 'task',
      taskId: dt.id,
      status: dt.status,
    });
  }
  events.sort((a, b) => a.at.localeCompare(b.at));

  const statusCounts = tasks.reduce<Record<string, number>>((acc, tk) => {
    acc[tk.status] = (acc[tk.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {health.status === 'healthy' && <AutomationBanner status={health.status} agoLabel={health.agoLabel} />}
      </div>
      {health.status !== 'healthy' && <AutomationBanner status={health.status} agoLabel={health.agoLabel} />}

      <AgentWorkView
        todayKey={dayKey(now, tz)}
        weekStart={weekStart}
        statusCounts={statusCounts}
        tasks={tasks.map((tk) => ({
          id: tk.id,
          title: tk.title,
          status: tk.status,
          priority: tk.priority,
          progress: tk.progress,
          agentName: tk.agent?.name ?? null,
          tokensUsed: tk.tokensUsed,
          attempts: tk._count.attempts,
          result: tk.result,
          createdAt: tk.createdAt.toISOString(),
          startedAt: tk.startedAt?.toISOString() ?? null,
          completedAt: tk.completedAt?.toISOString() ?? null,
          dueAt: tk.dueAt?.toISOString() ?? null,
          dependsOn: tk.dependsOn.flatMap((id) => {
            const d = depMap.get(id);
            return d ? [{ title: d.title, status: d.status as string }] : [];
          }),
        }))}
        schedules={schedules.map((s) => ({
          id: s.id,
          name: s.name,
          cronExpression: s.cronExpression,
          timezone: s.timezone,
          nextRunAt: s.nextRunAt?.toISOString() ?? null,
          lastRunAt: s.lastRunAt?.toISOString() ?? null,
          runCount: s.runCount,
          agentName: s.agent?.name ?? null,
        }))}
        events={events}
      />
    </div>
  );
}
