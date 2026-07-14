'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ChevronLeft, Sparkles, Wrench, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { TOOL_CATALOG, TOOL_GROUPS, type ToolGroup } from '@/lib/agent/tool-labels';
import { createSkill, updateSkill, deleteSkill } from '@/lib/actions/skills';

export interface SkillRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  instructions: string;
  tools: string[];
  agentCount: number;
}

const KNOWN_ERR = new Set(['name_required', 'not_found', 'unauthorized']);

export function SkillsManager({ skills }: { skills: SkillRow[] }) {
  const t = useTranslations('pages.skills');
  const [editing, setEditing] = useState<SkillRow | 'new' | null>(null);

  if (editing) {
    return <SkillEditor initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-4">
      {skills.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 py-10 text-center">
            <Sparkles className="mx-auto size-8 text-muted-foreground" />
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {skills.map((s) => (
          <button
            key={s.id}
            onClick={() => setEditing(s)}
            className="group flex items-start gap-3 rounded-2xl border bg-card p-4 text-start transition hover:bg-accent/30"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.name}</p>
              {s.description && <p className="line-clamp-1 text-xs text-muted-foreground">{s.description}</p>}
              <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Wrench className="size-3" />{t('toolsN', { count: s.tools.length })}</span>
                <span className="inline-flex items-center gap-1"><Users className="size-3" />{t('agentsN', { count: s.agentCount })}</span>
              </p>
            </div>
            <Pencil className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </button>
        ))}

        <button
          onClick={() => setEditing('new')}
          className="flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-4 text-muted-foreground transition hover:bg-accent/30 hover:text-foreground"
        >
          <Plus className="size-5" />
          <span className="text-sm font-medium">{t('newSkill')}</span>
        </button>
      </div>
    </div>
  );
}

function SkillEditor({ initial, onClose }: { initial: SkillRow | null; onClose: () => void }) {
  const t = useTranslations('pages.skills');
  const tc = useTranslations('common');
  const tg = useTranslations('agentForm');
  const router = useRouter();
  const confirm = useConfirm();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const errMsg = (code: string) => (KNOWN_ERR.has(code) ? t(`err.${code}`) : code);

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [tools, setTools] = useState<Set<string>>(new Set(initial?.tools ?? []));

  const toggleTool = (id: string) =>
    setTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    if (!name.trim()) {
      toast.error(t('err.name_required'));
      return;
    }
    startSave(async () => {
      const input = { name: name.trim(), description, instructions, tools: Array.from(tools) };
      const res = initial ? await updateSkill(initial.id, input) : await createSkill(input);
      if (res.ok) {
        toast.success(initial ? t('updated') : t('created'));
        router.refresh();
        onClose();
      } else toast.error(errMsg(res.error));
    });
  };

  const remove = () => {
    if (!initial) return;
    startDelete(async () => {
      if (!(await confirm({ title: t('deleteSkill'), description: t('deleteConfirm', { name: initial.name }), confirmLabel: tc('delete'), destructive: true }))) return;
      const res = await deleteSkill(initial.id);
      if (res.ok) {
        toast.success(t('deleted'));
        router.refresh();
        onClose();
      } else toast.error(errMsg(res.error));
    });
  };

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4 rtl:rotate-180" />
        {t('back')}
      </button>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-1.5">
            <Label>{t('name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('description')}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('instructions')}</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder={t('instructionsPlaceholder')} />
            <p className="text-xs text-muted-foreground">{t('instructionsHelp')}</p>
          </div>

          {/* Tool grant picker (grouped) */}
          <div className="space-y-2">
            <Label>{t('grantsTools')}</Label>
            <div className="space-y-3 rounded-xl border p-3">
              {TOOL_GROUPS.map((group) => {
                const items = TOOL_CATALOG.filter((tl) => tl.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {tg(`toolGroups.${group as ToolGroup}`)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((tl) => {
                        const on = tools.has(tl.id);
                        return (
                          <button
                            key={tl.id}
                            type="button"
                            onClick={() => toggleTool(tl.id)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs transition',
                              on ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent/50'
                            )}
                          >
                            {tl.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            {initial ? (
              <Button variant="ghost" onClick={remove} disabled={deleting} className="gap-1 text-destructive hover:text-destructive">
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {t('deleteSkill')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>{tc('cancel')}</Button>
              <Button onClick={save} disabled={saving} className="gap-1">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {initial ? tc('save') : t('createSkill')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
