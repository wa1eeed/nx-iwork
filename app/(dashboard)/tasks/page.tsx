import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { TaskManager } from '@/components/dashboard/task-manager';

export default async function TasksPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [tasks, agents] = companyId
    ? await Promise.all([
        db.task.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            title: true,
            status: true,
            kind: true,
            priority: true,
            result: true,
            dueAt: true,
            agent: { select: { name: true } },
          },
        }),
        db.agent.findMany({
          where: { companyId, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">المهام</h1>
        <p className="text-sm text-muted-foreground">
          كلّف موظفيك بمهام ونفّذها الآن. الجدولة التلقائية تأتي قريباً.
        </p>
      </div>

      <TaskManager
        agents={agents}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          kind: t.kind,
          priority: t.priority,
          result: t.result,
          dueAt: t.dueAt?.toISOString() ?? null,
          agentName: t.agent?.name ?? null,
        }))}
      />
    </div>
  );
}
