import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { TaskManager } from '@/components/dashboard/task-manager';
import { CrmTabs } from '@/components/dashboard/crm-tabs';

export default async function TasksPage() {
  const t = await getTranslations('pages.tasks');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [tasks, schedules, agents] = companyId
    ? await Promise.all([
        db.task.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: {
            id: true,
            title: true,
            status: true,
            kind: true,
            priority: true,
            result: true,
            createdAt: true,
            completedAt: true,
            agent: { select: { name: true } },
          },
        }),
        db.agentSchedule.findMany({
          where: { companyId, isActive: true },
          orderBy: { nextRunAt: 'asc' },
          select: {
            id: true,
            name: true,
            cronExpression: true,
            nextRunAt: true,
            runCount: true,
            agent: { select: { name: true } },
          },
        }),
        db.agent.findMany({
          where: { companyId, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [[], [], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CrmTabs />

      <TaskManager
        agents={agents}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          kind: t.kind,
          priority: t.priority,
          result: t.result,
          createdAt: t.createdAt.toISOString(),
          completedAt: t.completedAt?.toISOString() ?? null,
          agentName: t.agent?.name ?? null,
        }))}
        schedules={schedules.map((s) => ({
          id: s.id,
          name: s.name,
          cronExpression: s.cronExpression,
          nextRunAt: s.nextRunAt?.toISOString() ?? null,
          runCount: s.runCount,
          agentName: s.agent?.name ?? null,
        }))}
      />
    </div>
  );
}
