'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
  Loader2,
  AlertTriangle,
  Check,
  Target,
  Zap,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AgentForm } from '@/components/dashboard/agent-form';
import { createAgentFromTemplate } from '@/lib/actions/agents';
import { celebrate } from '@/lib/ui/celebrate';
import type { ConflictResult } from '@/lib/agent/conflict-check';

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

type Dept = { id: string; name: string };

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
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [preselect, setPreselect] = useState<string | null>(null);

  const hints = templates.map((tpl) => ({
    templateType: tpl.templateType,
    roleName: tpl.roleName,
    roleNameEn: tpl.roleNameEn,
  }));

  // HR Advisory: jump from a custom role into the matching template.
  function useTemplate(templateType: string) {
    setPreselect(templateType);
    setMode('template');
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border p-1">
        <button
          onClick={() => setMode('template')}
          className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mode === 'template' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
        >
          {t('modeTemplate')}
        </button>
        <button
          onClick={() => setMode('custom')}
          className={cn('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', mode === 'custom' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
        >
          {t('modeCustom')}
        </button>
      </div>

      {mode === 'custom' ? (
        <AgentForm departments={departments} managers={managers} templates={hints} onUseTemplate={useTemplate} />
      ) : (
        <TemplateBrowser templates={templates} departments={departments} managers={managers} initialSelected={preselect} />
      )}
    </div>
  );
}

function TemplateBrowser({
  templates,
  departments,
  managers,
  initialSelected,
}: {
  templates: TemplateCard[];
  departments: Dept[];
  managers: { id: string; name: string }[];
  initialSelected?: string | null;
}) {
  const t = useTranslations('agentCreate');
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '');
  const [parentId, setParentId] = useState('');
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [hiring, startHire] = useTransition();
  const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

  function hire(templateType: string, role: string, force = false) {
    if (!deptId) return toast.error(t('needDept'));
    startHire(async () => {
      const res = await createAgentFromTemplate(templateType, deptId, { parentId: parentId || null, force });
      if (res.ok) {
        celebrate();
        toast.success(t('hired', { role }));
        router.push(`/agents/${res.id}`);
        router.refresh();
      } else if (res.error === 'conflict') {
        setConflict(res.conflict);
      } else {
        toast.error(t('hireFailed'));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t('templatesTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('templatesSubtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {templates.map((tpl) => {
          const Icon = ICONS[tpl.icon] ?? Bot;
          const role = locale === 'ar' ? tpl.roleName : tpl.roleNameEn;
          const dept = locale === 'ar' ? tpl.department : tpl.departmentEn;
          const desc = locale === 'ar' ? tpl.roleDescription : tpl.roleDescriptionEn;
          const isOpen = selected === tpl.templateType;
          return (
            <Card key={tpl.templateType} className={cn('flex flex-col transition', isOpen && 'ring-1 ring-primary')}>
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${tpl.accent}22`, color: tpl.accent }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{role}</p>
                    <p className="text-xs text-muted-foreground">{dept}</p>
                  </div>
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{desc}</p>
                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Target className="h-3 w-3" />{tpl.kpiCount} {t('kpisLabel')}</span>
                  <span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" />{tpl.scenarioCount} {t('scenariosLabel')}</span>
                  <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" />{tpl.toolCount} {t('toolsLabel')}</span>
                </div>

                {isOpen ? (
                  <div className="space-y-3 border-t pt-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('department')}</Label>
                      {departments.length === 0 ? (
                        <p className="text-sm text-destructive">{t('needDept')}</p>
                      ) : (
                        <select className={selectCls} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('manager')}</Label>
                      <select className={selectCls} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                        <option value="">{t('none')}</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    {conflict && (
                      <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">{t('conflictTitle')}</p>
                          <p>{conflict.reason}</p>
                          <button className="mt-1 underline" onClick={() => hire(tpl.templateType, role, true)} disabled={hiring}>
                            {t('createAnyway')}
                          </button>
                        </div>
                      </div>
                    )}
                    <Button className="w-full" onClick={() => hire(tpl.templateType, role)} disabled={hiring || departments.length === 0}>
                      {hiring ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <Check className="me-1 h-4 w-4" />}
                      {t('hire')} · {role}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => { setSelected(tpl.templateType); setConflict(null); }}>
                    {t('select')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
