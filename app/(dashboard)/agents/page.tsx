import Link from 'next/link';
import { Plus, Users, MessageSquare } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_LABEL: Record<string, string> = {
  ONLINE: 'متصل',
  WORKING: 'يعمل',
  PAUSED: 'متوقف',
  OFFLINE: 'غير متصل',
};

// The AI Office: every employee, grouped by department.
export default async function AgentsPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [departments, hasDept] = companyId
    ? await Promise.all([
        db.department.findMany({
          where: { companyId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            color: true,
            agents: {
              where: { status: { not: 'ARCHIVED' } },
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                name: true,
                initial: true,
                role: true,
                status: true,
                model: true,
                tasksCompleted: true,
              },
            },
          },
        }),
        db.department.count({ where: { companyId } }),
      ])
    : [[], 0];

  const totalAgents = departments.reduce((n, d) => n + d.agents.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">الموظفون</h1>
          <p className="text-sm text-muted-foreground">
            فريقك من موظفي الذكاء الاصطناعي، موزّعين على الأقسام.
          </p>
        </div>
        {hasDept > 0 && (
          <Button asChild>
            <Link href="/agents/new">
              <Plus className="me-1 h-4 w-4" />
              موظف جديد
            </Link>
          </Button>
        )}
      </div>

      {hasDept === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              أنشئ قسماً أولاً، ثم عيّن فيه موظفين.
            </p>
            <Button asChild variant="outline">
              <Link href="/departments">إنشاء قسم</Link>
            </Button>
          </CardContent>
        </Card>
      ) : totalAgents === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">لا موظفين بعد.</p>
            <Button asChild variant="outline">
              <Link href="/agents/new">أنشئ أول موظف</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {departments
            .filter((d) => d.agents.length > 0)
            .map((d) => (
              <section key={d.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <h2 className="text-sm font-medium text-muted-foreground">{d.name}</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {d.agents.map((a) => (
                    <Card key={a.id} className="transition hover:border-primary/50">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
                            {a.initial}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{a.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{a.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {STATUS_LABEL[a.status] ?? a.status}
                          </span>
                          <span>{a.tasksCompleted} مهمة منجزة</span>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm" className="flex-1">
                            <Link href={`/agents/${a.id}`}>تعديل</Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href="/chat">
                              <MessageSquare className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
