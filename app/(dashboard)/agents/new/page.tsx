import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { getActiveTemplates } from '@/lib/agent/templates';
import { AgentCreator, type TemplateCard } from '@/components/dashboard/agent-creator';
import { getProviderForCompany } from '@/lib/ai';

function len(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

// Build a persona string from the template's structured personality profile.
function buildPersona(pp: unknown): string {
  const p = (pp ?? {}) as { tone?: string; traits?: string[] };
  return [p.tone, (p.traits ?? []).join('، ')].filter(Boolean).join(' — ');
}

export default async function NewAgentPage() {
  const t = await getTranslations('agentCreate');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [departments, managers, templates, allModels, providerResult] = companyId
    ? await Promise.all([
        db.department.findMany({
          where: { companyId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true },
        }),
        db.agent.findMany({
          where: { companyId, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        getActiveTemplates(),
        db.aiModel.findMany({
          where: { enabled: true },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          select: { id: true, label: true, provider: true, tier: true },
        }),
        getProviderForCompany(companyId),
      ])
    : [[], [], [], [], null];

  // Only models on the active provider actually run — filter so the picker can't
  // offer a model that would be silently dropped at inference.
  const activeProvider = providerResult && providerResult.ok ? providerResult.provider.id : null;
  const models = activeProvider ? allModels.filter((m) => m.provider === activeProvider) : allModels;

  const cards: TemplateCard[] = templates.map((tpl) => ({
    templateType: tpl.templateType,
    roleName: tpl.roleName,
    roleNameEn: tpl.roleNameEn,
    department: tpl.department,
    departmentEn: tpl.departmentEn,
    roleDescription: tpl.roleDescription,
    roleDescriptionEn: tpl.roleDescriptionEn,
    icon: tpl.icon,
    accent: tpl.accent,
    kpiCount: len(tpl.defaultKpis),
    scenarioCount: len(tpl.ifThenScenarios),
    toolCount: len(tpl.defaultPermissions),
    // Prefill for the configure step (Step 1).
    model: tpl.model,
    persona: buildPersona(tpl.personalityProfile),
    jobDescription: tpl.coreInstructions,
    permissions: (tpl.defaultPermissions as string[] | null) ?? [],
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        {t('back')}
      </Link>
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <AgentCreator templates={cards} departments={departments} managers={managers} models={models} />
    </div>
  );
}
