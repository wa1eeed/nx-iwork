'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bot,
  TrendingUp,
  Headphones,
  Megaphone,
  Package,
  Wallet,
  CalendarCheck,
  UserSearch,
  Share2,
  Handshake,
  Plus,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { AgentForm, type AgentFormValues } from '@/components/dashboard/agent-form';

export interface TemplateCard {
  templateType: string;
  roleName: string;
  roleNameEn: string;
  department: string;
  departmentEn: string;
  roleDescription: string;
  roleDescriptionEn: string;
  icon: string;
  accent: string;
  kpiCount: number;
  scenarioCount: number;
  toolCount: number;
  // Prefill for the configure step.
  model: 'HAIKU' | 'SONNET' | 'OPUS';
  persona: string;
  jobDescription: string;
  permissions: string[];
}

const ICONS: Record<string, LucideIcon> = {
  'trending-up': TrendingUp,
  headphones: Headphones,
  megaphone: Megaphone,
  package: Package,
  wallet: Wallet,
  'calendar-check': CalendarCheck,
  'user-search': UserSearch,
  'share-2': Share2,
  handshake: Handshake,
  bot: Bot,
};

const TIER: Record<string, string> = { HAIKU: 'Fast', SONNET: 'Balanced', OPUS: 'Advanced' };

type Dept = { id: string; name: string };

// Two-step hire: pick a template (or build custom) → configure & onboard. Both
// paths flow through the SAME AgentForm — the new-direction configure step (job
// description that governs, per-department tool matrix, autonomy, HR advisory).
export function AgentCreator({
  templates,
  departments,
  managers,
}: {
  templates: TemplateCard[];
  departments: Dept[];
  managers: { id: string; name: string }[];
}) {
  const t = useTranslations('agentCreate');
  const [configuring, setConfiguring] = useState<TemplateCard | 'custom' | null>(null);

  const hints = templates.map((tpl) => ({
    templateType: tpl.templateType,
    roleName: tpl.roleName,
    roleNameEn: tpl.roleNameEn,
  }));

  if (configuring) {
    const initial =
      configuring === 'custom' ? undefined : templateToInitial(configuring, departments);
    return (
      <div className="space-y-4">
        <button
          onClick={() => setConfiguring(null)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t('backToTemplates')}
        </button>
        <AgentForm
          departments={departments}
          managers={managers}
          initial={initial}
          templates={hints}
          onUseTemplate={(tt) => {
            const tpl = templates.find((x) => x.templateType === tt);
            if (tpl) setConfiguring(tpl);
          }}
        />
      </div>
    );
  }

  return <TemplatesGrid templates={templates} onPick={setConfiguring} onCustom={() => setConfiguring('custom')} />;
}

function templateToInitial(tpl: TemplateCard, departments: Dept[]): AgentFormValues {
  const dept =
    departments.find((d) => d.name === tpl.department || d.name === tpl.departmentEn) ?? departments[0];
  return {
    name: '',
    nameEn: '',
    role: tpl.roleName,
    roleEn: tpl.roleNameEn,
    persona: tpl.persona || tpl.roleName,
    jobDescription: tpl.jobDescription,
    departmentId: dept?.id ?? '',
    parentId: '',
    model: tpl.model,
    autonomy: 'ASK',
    temperature: 0.6,
    systemPrompt: '',
    permissions: tpl.permissions,
  };
}

function TemplatesGrid({
  templates,
  onPick,
  onCustom,
}: {
  templates: TemplateCard[];
  onPick: (t: TemplateCard) => void;
  onCustom: () => void;
}) {
  const t = useTranslations('agentCreate');
  const locale = useLocale();
  const ar = locale === 'ar';
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('templatesTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('templatesSubtitle')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((tpl) => {
          const Icon = ICONS[tpl.icon] ?? Bot;
          const role = ar ? tpl.roleName : tpl.roleNameEn;
          const dept = ar ? tpl.department : tpl.departmentEn;
          return (
            <button
              key={tpl.templateType}
              onClick={() => onPick(tpl)}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 text-start transition hover:bg-accent/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${tpl.accent}22`, color: tpl.accent }}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{role}</p>
                <p className="text-xs text-muted-foreground">
                  {dept} · {TIER[tpl.model]}
                </p>
              </div>
            </button>
          );
        })}
        <button
          onClick={onCustom}
          className="flex items-center gap-3 rounded-2xl border border-dashed p-4 text-start transition hover:bg-accent/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Plus className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">{t('buildCustom')}</p>
            <p className="text-xs text-muted-foreground">{t('buildCustomHint')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
