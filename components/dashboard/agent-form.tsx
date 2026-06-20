'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, AlertTriangle, Lightbulb, Plus, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createAgent, updateAgent } from '@/lib/actions/agents';
import { TRIGGER_EVENTS } from '@/lib/agent/events-catalog';
import type { AgentInput } from '@/lib/validators/agents';
import type { ConflictResult } from '@/lib/agent/conflict-check';

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
  departmentId: string;
  parentId: string;
  model: 'HAIKU' | 'SONNET' | 'OPUS';
  temperature: number;
  systemPrompt: string;
}

const DEFAULTS: AgentFormValues = {
  name: '',
  nameEn: '',
  role: '',
  roleEn: '',
  persona: '',
  departmentId: '',
  parentId: '',
  model: 'HAIKU',
  temperature: 0.6,
  systemPrompt: '',
};

export function AgentForm({
  departments,
  managers,
  initial,
  templates,
  onUseTemplate,
}: {
  departments: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  initial?: AgentFormValues;
  templates?: TemplateHint[];
  onUseTemplate?: (templateType: string) => void;
}) {
  const t = useTranslations('agentForm');
  const tc = useTranslations('common');
  const te = useTranslations('events');
  const router = useRouter();
  const [v, setV] = useState<AgentFormValues>(
    initial ?? { ...DEFAULTS, departmentId: departments[0]?.id ?? '' }
  );
  const [saving, startSave] = useTransition();
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [scenarios, setScenarios] = useState<FormScenario[]>([]);
  const [draft, setDraft] = useState<FormScenario>({ event: TRIGGER_EVENTS[0], action: '' });
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

  const MODELS: { value: AgentFormValues['model']; label: string; hint: string }[] = [
    { value: 'HAIKU', label: t('models.haiku'), hint: t('models.haikuHint') },
    { value: 'SONNET', label: t('models.sonnet'), hint: t('models.sonnetHint') },
    { value: 'OPUS', label: t('models.opus'), hint: t('models.opusHint') },
  ];

  function set<K extends keyof AgentFormValues>(k: K, val: AgentFormValues[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function submit(force = false) {
    if (!v.name.trim()) return toast.error(t('nameRequired'));
    if (!v.role.trim()) return toast.error(t('roleRequired'));
    if (!v.departmentId) return toast.error(t('deptRequired'));
    if (!v.persona.trim()) return toast.error(t('personaRequired'));

    const payload: AgentInput = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      role: v.role.trim(),
      roleEn: v.roleEn.trim() || null,
      persona: v.persona.trim(),
      departmentId: v.departmentId,
      parentId: v.parentId || null,
      model: v.model,
      temperature: v.temperature,
      maxTokens: 4096,
      systemPrompt: v.systemPrompt.trim() || null,
    };

    startSave(async () => {
      const res = isEdit
        ? await updateAgent(initial!.id!, payload)
        : await createAgent(payload, { force, scenarios });
      if (res.ok) {
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
          <CardTitle className="text-lg">{t('personalitySection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('persona')} *</Label>
            <Textarea rows={5} value={v.persona} onChange={(e) => set('persona', e.target.value)} placeholder={t('personaPlaceholder')} dir="auto" />
            <p className="text-xs text-muted-foreground">{t('personaHelp')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('extraInstructions')}</Label>
            <Textarea rows={3} value={v.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} placeholder={t('extraPlaceholder')} dir="auto" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('intelligence')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('modelLevel')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => set('model', m.value)}
                  className={
                    'rounded-lg border p-3 text-start ' +
                    (v.model === m.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted')
                  }
                >
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('creativity', { value: v.temperature })}</Label>
              <input type="range" min={0} max={1} step={0.1} value={v.temperature} onChange={(e) => set('temperature', Number(e.target.value))} className="w-full" />
              <p className="text-xs text-muted-foreground">{t('creativityHelp')}</p>
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
          </div>
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

          {scenarios.map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
              <Zap className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{te(s.event)}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.action}</span>
              </span>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setScenarios((p) => p.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

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
