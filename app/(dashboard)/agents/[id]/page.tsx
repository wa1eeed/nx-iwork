import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Sparkles, Gauge, Brain } from 'lucide-react';
import { HolographicAvatar } from '@/components/dashboard/holographic-avatar';
import { deptHue } from '@/lib/ui/dept-accent';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { AgentForm, type AgentFormValues } from '@/components/dashboard/agent-form';
import { ArchiveAgentButton } from '@/components/dashboard/archive-agent-button';
import { AgentSchedules } from '@/components/dashboard/agent-schedules';
import { AgentActivity } from '@/components/dashboard/agent-activity';
import { getToolsForAgent } from '@/lib/agent/tools';
import { TOOL_LABELS } from '@/lib/agent/tool-labels';
import { formatNumber, formatDate } from '@/lib/format';
import { AgentScenarios } from '@/components/dashboard/agent-scenarios';
import type { AgentKpi } from '@/lib/agent/templates';

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations('agentProfile');
  const ta = await getTranslations('pages.agents');
  const locale = await getLocale();
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const [agent, departments, managers, schedules, settings, tasks, company, scenarios, memories] = await Promise.all([
    db.agent.findFirst({
      where: { id, companyId },
      include: { department: { select: { name: true, nameEn: true, color: true } } },
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
    db.agentMemory.findMany({
      where: { agentId: id, companyId },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: { id: true, summary: true, importance: true, category: true, createdAt: true },
    }),
  ]);

  if (!agent) notFound();

  const kpis = (agent.kpis as unknown as AgentKpi[] | null) ?? [];

  // Capabilities = the tools it actually receives = module-enabled ∩ its permissions.
  const tools = getToolsForAgent(
    {
      hasEcommerce: company?.hasEcommerce ?? true,
      hasServices: company?.hasServices ?? true,
      hasBookings: company?.hasBookings ?? false,
    },
    agent.permissions
  );

  const initial: AgentFormValues = {
    id: agent.id,
    name: agent.name,
    nameEn: agent.nameEn ?? '',
    role: agent.role,
    roleEn: agent.roleEn ?? '',
    persona: agent.persona,
    jobDescription: agent.jobDescription ?? '',
    departmentId: agent.departmentId,
    parentId: agent.parentId ?? '',
    model: agent.model,
    temperature: agent.temperature,
    systemPrompt: agent.systemPrompt ?? '',
    permissions: agent.permissions,
  };

  const en = locale === 'en';
  const hue = deptHue({ name: agent.department.name, nameEn: agent.department.nameEn, id: agent.departmentId });
  const deptName = en ? agent.department.nameEn || agent.department.name : agent.department.name;
  const roleLabel = en ? agent.roleEn || agent.role : agent.role;
  const manager = managers.find((m) => m.id === agent.parentId);
  const tierLabel = ({ HAIKU: 'Fast', SONNET: 'Balanced', OPUS: 'Advanced' } as const)[agent.model];
  const avatarStatus =
    agent.status === 'ONBOARDING' ? 'ONBOARDING' : agent.status === 'PAUSED' ? 'PAUSED' : agent.status === 'OFFLINE' ? 'IDLE' : 'ONLINE';

  return (
    <div style={{ ['--dept-h' as string]: String(hue) }} className="space-y-6">
      {/* Department-accent banner */}
      <div className="h-2 rounded-full dept-accent-bg" />

      <div className="flex items-center justify-between">
        <Link href="/overview" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t('backToCenter')}
        </Link>
        <ArchiveAgentButton id={agent.id} />
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <HolographicAvatar seed={agent.id} hue={hue} size={72} status={avatarStatus} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {agent.ref && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" dir="ltr">{agent.ref}</span>
            )}
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <span className="dept-tint-bg dept-accent-text rounded-full px-2.5 py-0.5 text-xs font-semibold">{ta(`status.${agent.status}`)}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {roleLabel} · {deptName} · {t('reportsTo')} {manager?.name ?? t('owner')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs text-muted-foreground">
          {tierLabel} {t('model')}
        </span>
      </div>

      {/* Persona callout */}
      {agent.persona && (
        <div className="dept-tint-bg dept-accent-border rounded-2xl border p-4 text-sm leading-relaxed text-foreground/85">
          {agent.persona}
        </div>
      )}

      <Tabs defaultValue="activity">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="activity">{t('tabs.activity')}</TabsTrigger>
          <TabsTrigger value="scenarios">{t('tabs.scenarios')}</TabsTrigger>
          <TabsTrigger value="kpis">{t('tabs.kpis')}</TabsTrigger>
          <TabsTrigger value="memory">{t('tabs.memory')}</TabsTrigger>
          <TabsTrigger value="settings">{t('tabs.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                {t('capabilities')}
              </p>
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <span key={tool.name} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    {TOOL_LABELS[tool.name] ?? tool.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{t('capabilitiesNote')}</p>
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

        <TabsContent value="scenarios" className="space-y-4">
          <AgentScenarios agentId={agent.id} scenarios={scenarios} />
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Gauge className="h-6 w-6" />
              </span>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{t('performanceScore')}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {agent.performanceScore.toFixed(0)}<span className="text-base text-muted-foreground">/100</span>
                </p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-lg font-semibold text-emerald-500">{agent.tasksCompleted}</p>
                  <p className="text-[11px] text-muted-foreground">{t('completed')}</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-destructive">{agent.tasksFailed}</p>
                  <p className="text-[11px] text-muted-foreground">{t('failed')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('monthlyTokens')}</span>
                <span className="font-mono tabular-nums" dir="ltr">
                  {formatNumber(agent.periodTokensUsed, locale)}
                  {agent.tokenLimit > 0 ? ` / ${formatNumber(agent.tokenLimit, locale)}` : ` · ${t('unlimited')}`}
                </span>
              </div>
              {agent.tokenLimit > 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (agent.periodTokensUsed / agent.tokenLimit) * 100)}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">{t('kpiTargets')}</p>
              {kpis.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t('noKpis')}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {kpis.map((k) => (
                    <div key={k.key} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm">{k.label}</span>
                      <span className="font-mono text-sm font-semibold tabular-nums" dir="ltr">
                        {k.target}{k.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Brain className="h-4 w-4 text-primary" />
                  {t('memoryTitle')}
                </p>
                <p className="text-xs text-muted-foreground">{t('memorySubtitle')}</p>
              </div>
              {memories.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('noMemory')}</p>
              ) : (
                <ul className="space-y-2">
                  {memories.map((m) => (
                    <li key={m.id} className="rounded-lg border p-3">
                      <div className="mb-1 flex items-center gap-2">
                        {m.category && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                            {m.category}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {t('importance')}: {m.importance}/10
                        </span>
                        <span className="ms-auto text-[10px] text-muted-foreground">
                          {formatDate(m.createdAt, locale)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground/90">{m.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <AgentForm departments={departments} managers={managers} initial={initial} />
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
