import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Sparkles, Gauge, Brain, Database, Network, MessageSquare } from 'lucide-react';
import { HolographicAvatar } from '@/components/dashboard/holographic-avatar';
import { deptHue } from '@/lib/ui/dept-accent';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { AgentForm, type AgentFormValues } from '@/components/dashboard/agent-form';
import { ArchiveAgentButton } from '@/components/dashboard/archive-agent-button';
import { PauseAgentButton } from '@/components/dashboard/pause-agent-button';
import { AgentSchedules } from '@/components/dashboard/agent-schedules';
import { AgentActivity } from '@/components/dashboard/agent-activity';
import { getToolsForAgent } from '@/lib/agent/tools';
import { TOOL_LABELS } from '@/lib/agent/tool-labels';
import { formatNumber, formatDate } from '@/lib/format';
import { AgentScenarios } from '@/components/dashboard/agent-scenarios';
import { parsePersonaConfig } from '@/lib/agent/persona';
import type { AgentKpi } from '@/lib/agent/templates';

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations('agentProfile');
  const ta = await getTranslations('pages.agents');
  const to = await getTranslations('outputs');
  const locale = await getLocale();
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const [agent, departments, managers, schedules, settings, tasks, company, scenarios, memories, pendingApprovals, taskCount, chatCount, memoryCount, agentOutputs] = await Promise.all([
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
    db.approval.findMany({
      where: { agentId: id, companyId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, decision: true },
    }),
    // 3-layer memory counts (episodic = tasks + conversations; semantic = vectors).
    db.task.count({ where: { agentId: id, companyId } }),
    db.chatMessage.count({ where: { agentId: id, companyId } }),
    db.agentMemory.count({ where: { agentId: id, companyId } }),
    // This agent's deliverables (the per-agent slice of the outputs hub).
    db.agentOutput.findMany({
      where: { agentId: id, companyId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, title: true, type: true, status: true, createdAt: true },
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

  const aiModels = await db.aiModel.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true, label: true, provider: true },
  });
  const initialPersona = parsePersonaConfig(agent.personaConfig);
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
    autonomy: agent.autonomy,
    temperature: agent.temperature,
    systemPrompt: agent.systemPrompt ?? '',
    permissions: agent.permissions,
    aiModelId: agent.aiModelId ?? '',
    archetype: agent.archetype ?? 'front_desk',
    personaCfg: {
      tone: initialPersona?.tone ?? 'warm',
      verbosity: initialPersona?.verbosity ?? 'balanced',
      languagePolicy: initialPersona?.languagePolicy ?? 'mirror',
      dos: (initialPersona?.dos ?? []).join('\n'),
      donts: (initialPersona?.donts ?? []).join('\n'),
    },
  };

  const en = locale === 'en';
  const hue = deptHue({ name: agent.department.name, nameEn: agent.department.nameEn, id: agent.departmentId });
  const deptName = en ? agent.department.nameEn || agent.department.name : agent.department.name;
  const roleLabel = en ? agent.roleEn || agent.role : agent.role;
  const manager = managers.find((m) => m.id === agent.parentId);
  const tierLabel = ({ HAIKU: 'Fast', SONNET: 'Balanced', OPUS: 'Advanced' } as const)[agent.model];
  const avatarStatus =
    agent.status === 'ONBOARDING' ? 'ONBOARDING' : agent.status === 'PAUSED' ? 'PAUSED' : agent.status === 'OFFLINE' ? 'IDLE' : 'ONLINE';
  const needsYou = pendingApprovals.length > 0;

  // Header/rail status pill: "NEEDS YOU" (amber) when the agent paused a
  // decision for the owner, otherwise the live agent status.
  const statusPill = needsYou ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
      <span className="size-1.5 rounded-full bg-amber-500" /> NEEDS YOU
    </span>
  ) : (
    <span className="dept-tint-bg dept-accent-text rounded-full px-2.5 py-0.5 text-xs font-semibold">
      {ta(`status.${agent.status}`)}
    </span>
  );

  return (
    <div style={{ ['--dept-h' as string]: String(hue) }} className="space-y-6">
      {/* Department-accent banner */}
      <div className="h-2 rounded-full dept-accent-bg" />

      <div>
        <Link href="/overview" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t('backToCenter')}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <HolographicAvatar seed={agent.id} hue={hue} size={72} status={avatarStatus} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {agent.ref && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground" dir="ltr">{agent.ref}</span>
            )}
            <h1 className="text-xl font-bold">{agent.name}</h1>
            {statusPill}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {roleLabel} · {deptName} · {t('reportsTo')} {manager?.name ?? t('owner')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-xs text-muted-foreground">
            {tierLabel} {t('model')}
          </span>
          <PauseAgentButton id={agent.id} paused={agent.status === 'PAUSED'} />
        </div>
      </div>

      {/* Persona callout */}
      {agent.persona && (
        <div className="dept-tint-bg dept-accent-border rounded-2xl border p-4 text-sm leading-relaxed text-foreground/85">
          {agent.persona}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Tabs defaultValue="activity">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="activity">{t('tabs.activity')}</TabsTrigger>
          <TabsTrigger value="outputs">{t('tabs.outputs')}</TabsTrigger>
          <TabsTrigger value="scenarios">{t('tabs.scenarios')}</TabsTrigger>
          <TabsTrigger value="kpis">{t('tabs.kpis')}</TabsTrigger>
          <TabsTrigger value="memory">{t('tabs.memory')}</TabsTrigger>
          <TabsTrigger value="settings">{t('tabs.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
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
            approvals={pendingApprovals.map((a) => ({ id: a.id, decision: a.decision }))}
          />

          {/* Internal-mode chat entry point (design View 2 → Activity). */}
          <Link
            href={`/chat?agent=${agent.id}`}
            className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:bg-accent"
          >
            <span className="dept-tint-bg dept-accent-text flex size-10 shrink-0 items-center justify-center rounded-xl">
              <MessageSquare className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('chatTitle', { name: agent.name })}</p>
              <p className="text-sm text-muted-foreground">{t('chatSubtitle')}</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          </Link>
        </TabsContent>

        <TabsContent value="outputs" className="space-y-3">
          {agentOutputs.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {to('empty')}
            </div>
          ) : (
            <>
              {agentOutputs.map((o) => (
                <Link
                  key={o.id}
                  href="/outputs"
                  className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:bg-accent"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
                    <Sparkles className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{o.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {to(`type.${o.type}`)} · {to(`status.${o.status}`)}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                </Link>
              ))}
              <Link href="/outputs" className="block text-center text-xs text-muted-foreground hover:text-foreground">
                {to('title')} →
              </Link>
            </>
          )}
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

        <TabsContent value="memory" className="space-y-5">
          {/* 3-layer memory (design View 2 → Memory) — real per-agent counts. */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('threeLayer')}
            </p>
            <div className="space-y-3">
              {[
                { icon: Brain, title: t('workingTitle'), desc: t('workingDesc') },
                {
                  icon: Database,
                  title: t('episodicTitle'),
                  desc: t('episodicDesc', { count: formatNumber(taskCount + chatCount, locale) }),
                },
                {
                  icon: Network,
                  title: t('semanticTitle'),
                  desc: t('semanticDesc', { count: formatNumber(memoryCount, locale) }),
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
                  <span className="dept-tint-bg dept-accent-text flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stored semantic memories (the vectors themselves). */}
          {memories.length > 0 && (
            <div>
              <div className="mb-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="dept-accent-text h-4 w-4" />
                  {t('memoryTitle')}
                </p>
                <p className="text-xs text-muted-foreground">{t('memorySubtitle')}</p>
              </div>
              <ul className="space-y-2">
                {memories.map((m) => (
                  <li key={m.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      {m.category && (
                        <span className="dept-tint-bg dept-accent-text rounded-full px-2 py-0.5 text-[10px]">
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
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <AgentForm departments={departments} managers={managers} initial={initial} models={aiModels} />
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
          {/* Danger zone — archiving keeps chat history + task records. */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">{t('archiveTitle')}</p>
              <p className="text-xs text-muted-foreground">{t('archiveNote')}</p>
            </div>
            <ArchiveAgentButton id={agent.id} />
          </div>
        </TabsContent>
        </Tabs>

        {/* Always-on facts rail */}
        <aside className="space-y-4">
          <div className="rounded-2xl border bg-card p-4">
            {[
              { l: t('factStatus'), v: statusPill },
              { l: t('factModel'), v: tierLabel },
              { l: t('factReportsTo'), v: manager?.name ?? t('owner') },
              { l: t('factDepartment'), v: deptName },
            ].map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-border py-2 first:pt-0 last:border-0 last:pb-0">
                <span className="text-xs text-muted-foreground">{r.l}</span>
                <span className="text-sm font-medium">{r.v}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('tokensThisMonth')}</p>
            <p className="mt-1 text-xl font-bold tabular-nums" dir="ltr">
              {formatNumber(agent.periodTokensUsed, locale)}
              <span className="text-sm font-normal text-muted-foreground">
                {agent.tokenLimit > 0 ? ` / ${formatNumber(agent.tokenLimit, locale)}` : ` · ${t('unlimited')}`}
              </span>
            </p>
            {agent.tokenLimit > 0 && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div
                  className="h-full dept-accent-bg"
                  style={{ width: `${Math.min(100, Math.round((agent.periodTokensUsed / Math.max(1, agent.tokenLimit)) * 100))}%` }}
                />
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">{t('capNote')}</p>
          </div>

          {/* Capabilities = the tools it actually receives (modules ∩ permissions). */}
          <div className="rounded-2xl border bg-card p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 dept-accent-text" />
              {t('capabilities')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tools.map((tool) => (
                <span key={tool.name} className="dept-tint-bg dept-accent-text rounded-full px-2.5 py-0.5 text-[11px]">
                  {TOOL_LABELS[tool.name] ?? tool.name}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
