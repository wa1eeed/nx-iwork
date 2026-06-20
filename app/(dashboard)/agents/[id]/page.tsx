import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { AgentForm, type AgentFormValues } from '@/components/dashboard/agent-form';
import { ArchiveAgentButton } from '@/components/dashboard/archive-agent-button';
import { AgentSchedules } from '@/components/dashboard/agent-schedules';
import { AgentActivity } from '@/components/dashboard/agent-activity';
import { getToolsForCompany } from '@/lib/agent/tools';
import { AgentScenarios } from '@/components/dashboard/agent-scenarios';
import { Sparkles } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  ONLINE: 'متصل',
  WORKING: 'يعمل',
  PAUSED: 'متوقف',
  OFFLINE: 'غير متصل',
};

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const [agent, departments, managers, schedules, settings, tasks, company, scenarios] = await Promise.all([
    db.agent.findFirst({
      where: { id, companyId },
      include: { department: { select: { name: true, color: true } } },
    }),
    db.department.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    db.agent.findMany({
      where: { companyId, status: { not: 'ARCHIVED' }, NOT: { id } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.agentSchedule.findMany({
      where: { agentId: id, companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        taskTemplate: true,
        cronExpression: true,
        isActive: true,
        nextRunAt: true,
        runCount: true,
      },
    }),
    db.businessSettings.findUnique({
      where: { companyId },
      select: { timezone: true },
    }),
    db.task.findMany({
      where: { agentId: id, companyId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, title: true, status: true, result: true, createdAt: true, completedAt: true },
    }),
    db.company.findUnique({
      where: { id: companyId },
      select: { hasEcommerce: true, hasServices: true, hasBookings: true },
    }),
    db.eventTrigger.findMany({
      where: { agentId: id, companyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, event: true, name: true, isActive: true, fireCount: true },
    }),
  ]);

  if (!agent) notFound();

  // Capabilities this agent has = the tools it receives (driven by enabled modules).
  const tools = getToolsForCompany({
    hasEcommerce: company?.hasEcommerce ?? true,
    hasServices: company?.hasServices ?? true,
    hasBookings: company?.hasBookings ?? false,
  });
  const TOOL_LABELS: Record<string, string> = {
    search_catalog: 'البحث في الكتالوج',
    check_availability: 'فحص التوافر',
    create_booking: 'إنشاء حجز',
    search_faq: 'الأسئلة الشائعة',
    find_customer: 'البحث عن عميل',
    create_lead: 'تسجيل عميل',
    update_lead: 'تحديث عميل',
    create_task: 'إنشاء مهمة',
    save_memory: 'الحفظ في الذاكرة',
  };

  const initial: AgentFormValues = {
    id: agent.id,
    name: agent.name,
    nameEn: agent.nameEn ?? '',
    role: agent.role,
    roleEn: agent.roleEn ?? '',
    persona: agent.persona,
    departmentId: agent.departmentId,
    parentId: agent.parentId ?? '',
    model: agent.model,
    temperature: agent.temperature,
    systemPrompt: agent.systemPrompt ?? '',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          الموظفون
        </Link>
        <ArchiveAgentButton id={agent.id} />
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-bold text-primary">
            {agent.initial}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">
              {agent.role} · <span style={{ color: agent.department.color }}>{agent.department.name}</span> ·{' '}
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {STATUS_LABEL[agent.status] ?? agent.status}
              </span>
            </p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-lg font-semibold text-emerald-500">{agent.tasksCompleted}</p>
              <p className="text-[11px] text-muted-foreground">منجزة</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-destructive">{agent.tasksFailed}</p>
              <p className="text-[11px] text-muted-foreground">فشل</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{agent.totalTokensUsed.toLocaleString('ar')}</p>
              <p className="text-[11px] text-muted-foreground">توكنز</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">النشاط والمهام</TabsTrigger>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                قدرات الموظف (الأدوات)
              </p>
              <div className="flex flex-wrap gap-2">
                {tools.map((t) => (
                  <span key={t.name} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    {TOOL_LABELS[t.name] ?? t.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                تتغيّر حسب الموديولات المفعّلة لشركتك.
              </p>
            </CardContent>
          </Card>

          <AgentActivity
            tasks={tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              result: t.result,
              createdAt: t.createdAt.toISOString(),
              completedAt: t.completedAt?.toISOString() ?? null,
            }))}
            schedules={schedules.map((s) => ({
              id: s.id,
              name: s.name,
              nextRunAt: s.nextRunAt?.toISOString() ?? null,
              runCount: s.runCount,
            }))}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <AgentForm departments={departments} managers={managers} initial={initial} />
          <AgentScenarios agentId={agent.id} scenarios={scenarios} />
          <AgentSchedules
            agentId={agent.id}
            timezone={settings?.timezone ?? 'Asia/Riyadh'}
            schedules={schedules.map((s) => ({
              id: s.id,
              name: s.name,
              taskTemplate: s.taskTemplate,
              cronExpression: s.cronExpression,
              isActive: s.isActive,
              nextRunAt: s.nextRunAt?.toISOString() ?? null,
              runCount: s.runCount,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
