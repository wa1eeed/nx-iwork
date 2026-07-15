'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, AlertTriangle, Lightbulb, Plus, Trash2, Zap, Wrench, ShieldCheck, FlaskConical, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createAgent, updateAgent } from '@/lib/actions/agents';
import { celebrate } from '@/lib/ui/celebrate';
import { TRIGGER_EVENTS } from '@/lib/agent/events-catalog';
import { TOOL_CATALOG, TOOL_GROUPS, type ToolGroup } from '@/lib/agent/tool-labels';
import { ARCHETYPES } from '@/lib/agent/archetypes';
import type { PersonaTone, PersonaVerbosity, LanguagePolicy } from '@/lib/agent/persona';
import { maxTokensForVerbosity } from '@/lib/agent/persona';
import type { AgentInput } from '@/lib/validators/agents';
import type { ConflictResult } from '@/lib/agent/conflict-check';

// Persona knobs edited in the form. Lists are newline-delimited textareas here
// and split into arrays on submit.
interface PersonaForm {
  tone: PersonaTone;
  verbosity: PersonaVerbosity;
  languagePolicy: LanguagePolicy;
  dos: string;
  donts: string;
}

export interface TemplateHint {
  templateType: string;
  roleName: string;
  roleNameEn: string;
}
interface FormScenario {
  event: string;
  action: string;
}

export interface AgentFormValues {
  id?: string;
  name: string;
  nameEn: string;
  role: string;
  roleEn: string;
  persona: string;
  jobDescription: string;
  departmentId: string;
  parentId: string;
  model: 'HAIKU' | 'SONNET' | 'OPUS';
  aiModelId: string; // '' = platform default (by tier)
  autonomy: 'SUGGEST' | 'ASK' | 'AUTOPILOT';
  temperature: number;
  systemPrompt: string;
  permissions: string[];
  archetype: string;
  personaCfg: PersonaForm;
  // Per-agent governance overrides (null = inherit the company guardrail).
  requireApprovalForSensitive: boolean | null;
  requireMessageReview: boolean | null;
  spendApprovalCapSar: number | null;
}

const DEFAULT_PERSONA: PersonaForm = {
  tone: 'warm',
  verbosity: 'balanced',
  languagePolicy: 'mirror',
  dos: '',
  donts: '',
};

// Newline-delimited textarea → trimmed, non-empty string array.
function splitLines(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}

// Seed tool allow-list for an archetype (its capability bundle).
function archPerms(key: string): string[] {
  return ARCHETYPES.find((a) => a.key === key)?.permissions ?? [];
}
function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

// "Response style" presets — a governed replacement for the raw temperature
// slider (precise ↔ creative). The stored value is still Agent.temperature.
const TEMP_PRESETS = [
  { key: 'stylePrecise', value: 0.2 },
  { key: 'styleBalanced', value: 0.6 },
  { key: 'styleCreative', value: 0.9 },
] as const;

const DEFAULTS: AgentFormValues = {
  name: '',
  nameEn: '',
  role: '',
  roleEn: '',
  persona: '',
  jobDescription: '',
  departmentId: '',
  parentId: '',
  model: 'HAIKU',
  aiModelId: '',
  autonomy: 'ASK',
  temperature: 0.6,
  systemPrompt: '',
  permissions: archPerms('front_desk'),
  archetype: 'front_desk',
  personaCfg: DEFAULT_PERSONA,
  requireApprovalForSensitive: null,
  requireMessageReview: null,
  spendApprovalCapSar: null,
};

export function AgentForm({
  departments,
  managers,
  initial,
  templates,
  models = [],
  onUseTemplate,
}: {
  departments: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  initial?: AgentFormValues;
  templates?: TemplateHint[];
  /** Enabled AI models from the registry, filtered to the active provider. */
  models?: { id: string; label: string; provider: string; tier?: string }[];
  onUseTemplate?: (templateType: string) => void;
}) {
  const t = useTranslations('agentForm');
  const tc = useTranslations('common');
  const te = useTranslations('events');
  const locale = useLocale();
  const en = locale === 'en';
  const router = useRouter();
  // Functional-area (department) labels for the per-department permission matrix.
  const groupLabel: Record<ToolGroup, string> = {
    sales: t('toolGroups.sales'),
    catalog: t('toolGroups.catalog'),
    bookings: t('toolGroups.bookings'),
    support: t('toolGroups.support'),
    operations: t('toolGroups.operations'),
    data: t('toolGroups.data'),
    integrations: t('toolGroups.integrations'),
    memory: t('toolGroups.memory'),
  };
  // Always start from DEFAULTS so newer fields (archetype/personaCfg) exist even
  // when `initial` predates them, then overlay whatever the caller provided.
  const [v, setV] = useState<AgentFormValues>({
    ...DEFAULTS,
    departmentId: departments[0]?.id ?? '',
    ...(initial ?? {}),
  });
  const [saving, startSave] = useTransition();
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [scenarios, setScenarios] = useState<FormScenario[]>([]);
  const [draft, setDraft] = useState<FormScenario>({ event: TRIGGER_EVENTS[0], action: '' });
  const [scenarioList] = useAutoAnimate<HTMLDivElement>();
  const isEdit = Boolean(initial?.id);

  // HR Advisory: surface the closest system template as a starting base.
  const suggestion = useMemo(() => {
    const q = v.role.trim().toLowerCase();
    if (isEdit || q.length < 3 || !templates?.length) return null;
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    let best: TemplateHint | null = null;
    let bestScore = 0;
    for (const tpl of templates) {
      const hay = `${tpl.roleNameEn} ${tpl.roleName}`.toLowerCase();
      const score = words.filter((w) => hay.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        best = tpl;
      }
    }
    return bestScore > 0 ? best : null;
  }, [v.role, templates, isEdit]);

  function addScenario() {
    if (!draft.action.trim()) return;
    setScenarios((prev) => [...prev, { ...draft, action: draft.action.trim() }]);
    setDraft({ event: TRIGGER_EVENTS[0], action: '' });
  }

  function togglePerm(id: string) {
    setV((p) => ({
      ...p,
      permissions: p.permissions.includes(id) ? p.permissions.filter((x) => x !== id) : [...p.permissions, id],
    }));
  }

  function set<K extends keyof AgentFormValues>(k: K, val: AgentFormValues[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  // ONE model picker: choosing a registry model pins it (aiModelId) and derives
  // its capability tier for the fallback path; "Default" clears it to the tier map.
  function pickModel(id: string) {
    const tier = models.find((m) => m.id === id)?.tier?.toUpperCase();
    const valid = tier === 'HAIKU' || tier === 'SONNET' || tier === 'OPUS';
    setV((p) => ({ ...p, aiModelId: id, model: id && valid ? (tier as AgentFormValues['model']) : 'SONNET' }));
  }

  // Selecting an archetype re-seeds the tool allow-list from its bundle — unless
  // the owner already hand-picked a custom set (least-privilege, still editable).
  function selectArchetype(key: string) {
    setV((p) => {
      const reseed = p.permissions.length === 0 || ARCHETYPES.some((a) => sameSet(a.permissions, p.permissions));
      return { ...p, archetype: key, permissions: reseed ? archPerms(key) : p.permissions };
    });
  }

  const activeTemp = TEMP_PRESETS.reduce((a, b) =>
    Math.abs(b.value - v.temperature) < Math.abs(a.value - v.temperature) ? b : a
  ).value;

  function submit(force = false) {
    if (!v.name.trim()) return toast.error(t('nameRequired'));
    if (!v.role.trim()) return toast.error(t('roleRequired'));
    if (!v.departmentId) return toast.error(t('deptRequired'));

    const payload: AgentInput = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      role: v.role.trim(),
      roleEn: v.roleEn.trim() || null,
      // Free-text persona is retired; server derives it from the mandate/role.
      persona: v.persona.trim() || null,
      jobDescription: v.jobDescription.trim() || null,
      departmentId: v.departmentId,
      parentId: v.parentId || null,
      model: v.model,
      aiModelId: v.aiModelId || null,
      autonomy: v.autonomy,
      temperature: v.temperature,
      // Response length is governed by the verbosity knob, not a hidden constant.
      maxTokens: maxTokensForVerbosity(v.personaCfg.verbosity),
      systemPrompt: v.systemPrompt.trim() || null,
      permissions: v.permissions,
      archetype: v.archetype,
      personaConfig: {
        tone: v.personaCfg.tone,
        verbosity: v.personaCfg.verbosity,
        languagePolicy: v.personaCfg.languagePolicy,
        dos: splitLines(v.personaCfg.dos),
        donts: splitLines(v.personaCfg.donts),
        signaturePhrases: [],
      },
      requireApprovalForSensitive: v.requireApprovalForSensitive,
      requireMessageReview: v.requireMessageReview,
      spendApprovalCapSar: v.spendApprovalCapSar,
    };

    startSave(async () => {
      const res = isEdit
        ? await updateAgent(initial!.id!, payload)
        : await createAgent(payload, { force, scenarios });
      if (res.ok) {
        if (!isEdit) celebrate();
        toast.success(isEdit ? t('saved') : t('created'));
        router.push('/agents');
        router.refresh();
      } else if (res.error === 'conflict') {
        setConflict(res.conflict);
      } else if (res.error === 'bad_department') {
        toast.error(t('badDept'));
      } else {
        toast.error(t('saveFailed'));
      }
    });
  }

  const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('identity')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('name')} *</Label>
              <Input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder={t('namePlaceholder')} dir="auto" />
            </div>
            <div className="space-y-2">
              <Label>{t('nameEn')}</Label>
              <Input dir="ltr" value={v.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('role')} *</Label>
              <Input value={v.role} onChange={(e) => { set('role', e.target.value); setConflict(null); }} placeholder={t('rolePlaceholder')} dir="auto" />
              {suggestion && onUseTemplate && (
                <div className="flex items-start gap-2 rounded-md bg-primary/5 p-2 text-xs">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div>
                    <span className="text-muted-foreground">
                      {t('advisory', { template: suggestion.roleNameEn })}
                    </span>{' '}
                    <button type="button" className="font-medium text-primary underline" onClick={() => onUseTemplate(suggestion.templateType)}>
                      {t('useTemplate')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('department')} *</Label>
              {departments.length === 0 ? (
                <p className="pt-2 text-sm text-destructive">{t('needDept')}</p>
              ) : (
                <select className={selectCls} value={v.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('roleModelSection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Archetype — the capability bundle + hard customer/internal scope. */}
          <div className="space-y-2">
            <Label>{t('archetypeLabel')}</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ARCHETYPES.map((a) => {
                const active = v.archetype === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => selectArchetype(a.key)}
                    className={cn(
                      'rounded-xl border p-3 text-start transition',
                      active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{en ? a.label.en : a.label.ar}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                          a.surface === 'CUSTOMER_FACING'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {a.surface === 'CUSTOMER_FACING' ? t('scopeCustomer') : t('scopeInternal')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{en ? a.summary.en : a.summary.ar}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{t('archetypeHelp')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('personalitySection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Structured persona — precise knobs compiled into the prompt. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t('toneLabel')}</Label>
              <select
                className={selectCls}
                value={v.personaCfg.tone}
                onChange={(e) => set('personaCfg', { ...v.personaCfg, tone: e.target.value as PersonaForm['tone'] })}
              >
                {(['warm', 'confident', 'empathetic', 'creative', 'organized', 'precise', 'formal', 'playful'] as const).map((k) => (
                  <option key={k} value={k}>{t(`tones.${k}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('verbosityLabel')}</Label>
              <select
                className={selectCls}
                value={v.personaCfg.verbosity}
                onChange={(e) => set('personaCfg', { ...v.personaCfg, verbosity: e.target.value as PersonaForm['verbosity'] })}
              >
                {(['concise', 'balanced', 'detailed'] as const).map((k) => (
                  <option key={k} value={k}>{t(`verbosities.${k}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('languageLabel')}</Label>
              <select
                className={selectCls}
                value={v.personaCfg.languagePolicy}
                onChange={(e) => set('personaCfg', { ...v.personaCfg, languagePolicy: e.target.value as PersonaForm['languagePolicy'] })}
              >
                {(['mirror', 'business', 'formal_ar', 'en'] as const).map((k) => (
                  <option key={k} value={k}>{t(`languages.${k}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('dosLabel')}</Label>
              <Textarea
                rows={3}
                value={v.personaCfg.dos}
                onChange={(e) => set('personaCfg', { ...v.personaCfg, dos: e.target.value })}
                placeholder={t('dosPlaceholder')}
                dir="auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('dontsLabel')}</Label>
              <Textarea
                rows={3}
                value={v.personaCfg.donts}
                onChange={(e) => set('personaCfg', { ...v.personaCfg, donts: e.target.value })}
                placeholder={t('dontsPlaceholder')}
                dir="auto"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('jobDescription')}</Label>
            <Textarea rows={5} value={v.jobDescription} onChange={(e) => set('jobDescription', e.target.value)} placeholder={t('jobDescriptionPlaceholder')} dir="auto" />
            <p className="text-xs text-muted-foreground">{t('jobDescriptionHelp')}</p>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{t('justifyTitle')}</span> {t('justifyBody')}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('intelligence')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ONE model selector: the registry model (already filtered to the
              active provider) OR "Default". Replaces the old tier-vs-registry
              split where "Fast" and "Balanced" resolved to the same model. */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-primary" />{t('aiModel')}</Label>
            {models.length > 0 ? (
              <select className={selectCls} value={v.aiModelId} onChange={(e) => pickModel(e.target.value)}>
                <option value="">{t('aiModelDefault')}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { val: 'SONNET', l: t('perfStandard'), h: t('perfStandardHint') },
                  { val: 'OPUS', l: t('perfAdvanced'), h: t('perfAdvancedHint') },
                ] as const).map((m) => (
                  <button
                    key={m.val}
                    type="button"
                    onClick={() => set('model', m.val)}
                    className={
                      'rounded-lg border p-3 text-start ' +
                      (v.model === m.val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted')
                    }
                  >
                    <span className="block text-sm font-medium">{m.l}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{m.h}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('aiModelHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('autonomyLabel')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                { v: 'SUGGEST', l: t('autonomySuggest'), h: t('autonomySuggestHint') },
                { v: 'ASK', l: t('autonomyAsk'), h: t('autonomyAskHint') },
                { v: 'AUTOPILOT', l: t('autonomyAutopilot'), h: t('autonomyAutopilotHint') },
              ] as const).map((a) => (
                <button
                  key={a.v}
                  type="button"
                  onClick={() => set('autonomy', a.v)}
                  className={
                    'rounded-lg border p-3 text-start ' +
                    (v.autonomy === a.v ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted')
                  }
                >
                  <span className="block text-sm font-medium">{a.l}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{a.h}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('autonomyHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('styleLabel')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMP_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => set('temperature', p.value)}
                  className={
                    'rounded-lg border p-3 text-center text-sm font-medium ' +
                    (activeTemp === p.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted')
                  }
                >
                  {t(p.key)}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('styleHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('manager')}</Label>
            <select className={selectCls} value={v.parentId} onChange={(e) => set('parentId', e.target.value)}>
              <option value="">{t('none')}</option>
              {managers.filter((m) => m.id !== initial?.id).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t('governanceSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('governanceHelp')}</p>
          {([
            { field: 'requireApprovalForSensitive' as const, label: t('govApprovalLabel') },
            { field: 'requireMessageReview' as const, label: t('govReviewLabel') },
          ]).map((row) => (
            <div key={row.field} className="space-y-1.5">
              <Label>{row.label}</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: null, l: t('govInherit') },
                  { val: true, l: t('govOn') },
                  { val: false, l: t('govOff') },
                ] as const).map((opt) => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setV((p) => ({ ...p, [row.field]: opt.val }))}
                    className={
                      'rounded-lg border px-3 py-2 text-sm ' +
                      (v[row.field] === opt.val ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted')
                    }
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>{t('govSpendLabel')}</Label>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={v.spendApprovalCapSar ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value);
                set('spendApprovalCapSar', e.target.value === '' || !Number.isFinite(n) ? null : Math.max(0, Math.floor(n)));
              }}
              placeholder={t('govSpendPlaceholder')}
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">{t('govSpendHelp')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-4 w-4 text-primary" />
            {t('permissionsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('permissionsHelp')}</p>
          {TOOL_GROUPS.map((group) => {
            const tools = TOOL_CATALOG.filter((tl) => tl.group === group);
            if (tools.length === 0) return null;
            return (
              <div key={group} className="space-y-2">
                <p className="text-xs font-semibold text-foreground">{groupLabel[group]}</p>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool) => {
                    const on = v.permissions.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => togglePerm(tool.id)}
                        className={cn(
                          'rounded-full border px-3 py-1 text-xs transition-colors',
                          on ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:bg-accent'
                        )}
                      >
                        {tool.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {!isEdit && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-4 w-4 text-amber-500" />
            {t('scenariosTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('scenariosHelp')}</p>

          <div ref={scenarioList} className="space-y-2 empty:hidden">
            {scenarios.map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{te(s.event)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.action}</span>
                </span>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setScenarios((p) => p.filter((_, j) => j !== i))} aria-label={tc('delete')}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('when')}</Label>
              <select className={selectCls} value={draft.event} onChange={(e) => setDraft((d) => ({ ...d, event: e.target.value }))}>
                {TRIGGER_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>{te(ev)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('thenDo')}</Label>
              <div className="flex gap-2">
                <Input value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} placeholder={t('thenPlaceholder')} dir="auto" />
                <Button type="button" variant="outline" onClick={addScenario} disabled={!draft.action.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {conflict && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t('conflictTitle')}</p>
              <p className="text-sm text-muted-foreground">{conflict.reason}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => submit(true)} disabled={saving}>
                {t('createAnyway')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isEdit && initial?.id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="h-4 w-4 text-primary" />
              {t('testTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t('testHelp')}</p>
            <Link
              href={`/studio?agent=${initial.id}`}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition hover:bg-muted"
            >
              <FlaskConical className="h-4 w-4" />
              {t('testCta')}
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push('/agents')} disabled={saving}>
          {tc('cancel')}
        </Button>
        <Button onClick={() => submit(false)} disabled={saving || departments.length === 0}>
          {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
          {isEdit ? tc('save') : t('create')}
        </Button>
      </div>
    </div>
  );
}
