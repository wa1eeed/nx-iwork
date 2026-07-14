'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { createAiModel, toggleAiModel, setDefaultAiModel, deleteAiModel } from '@/lib/actions/admin-models';

export interface ModelRow {
  id: string;
  provider: string;
  modelId: string;
  label: string;
  tier: 'HAIKU' | 'SONNET' | 'OPUS';
  enabled: boolean;
  isDefault: boolean;
}

const PROVIDERS = ['vertex', 'google', 'anthropic', 'openai'] as const;
const TIERS = ['HAIKU', 'SONNET', 'OPUS'] as const;

const PROVIDER_STYLE: Record<string, string> = {
  vertex: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  google: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  anthropic: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  openai: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
};

export function ModelsManager({ models }: { models: ModelRow[] }) {
  const confirm = useConfirm();
  const [busy, start] = useTransition();
  const [form, setForm] = useState({ provider: 'vertex', modelId: '', label: '', tier: 'SONNET' });

  const input = 'rounded-lg border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

  function add() {
    if (!form.modelId.trim() || !form.label.trim()) return;
    start(async () => {
      const res = await createAiModel({
        provider: form.provider as (typeof PROVIDERS)[number],
        modelId: form.modelId.trim(),
        label: form.label.trim(),
        tier: form.tier as (typeof TIERS)[number],
      });
      if (res.ok) {
        toast.success('Model added');
        setForm({ provider: form.provider, modelId: '', label: '', tier: form.tier });
      } else toast.error(res.error === 'duplicate' ? 'That model already exists' : 'Couldn’t add it');
    });
  }

  function toggle(m: ModelRow) {
    start(async () => {
      await toggleAiModel(m.id, !m.enabled);
    });
  }
  function makeDefault(m: ModelRow) {
    start(async () => {
      await setDefaultAiModel(m.id);
      toast.success(`${m.label} is now the default`);
    });
  }
  async function remove(m: ModelRow) {
    if (!(await confirm({ title: `Delete ${m.label}?`, description: 'Agents using it fall back to their tier.', destructive: true, confirmLabel: 'Delete', cancelLabel: 'Cancel' }))) return;
    start(async () => {
      await deleteAiModel(m.id);
    });
  }

  return (
    <div className="space-y-5">
      {/* Add a model — no code needed for a newly released model, just a row. */}
      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Add a model</p>
        <div className="flex flex-wrap items-end gap-2">
          <select className={input} value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className={cn(input, 'flex-1 min-w-[10rem]')} placeholder="model id (e.g. gemini-2.5-pro, gpt-4o)" value={form.modelId} onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))} dir="ltr" />
          <input className={cn(input, 'flex-1 min-w-[9rem]')} placeholder="Display name" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          <select className={input} value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}>
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={add} disabled={busy || !form.modelId.trim() || !form.label.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add
          </button>
        </div>
      </div>

      {/* Registry */}
      <div className="space-y-2">
        {models.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">No models yet — add one above.</div>
        ) : (
          models.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', PROVIDER_STYLE[m.provider] ?? 'bg-muted')}>{m.provider}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{m.label}</p>
                  {m.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"><Star className="size-2.5 fill-current" /> default</span>}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{m.tier}</span>
                </div>
                <p className="font-mono text-xs text-muted-foreground" dir="ltr">{m.modelId}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                <input type="checkbox" checked={m.enabled} onChange={() => toggle(m)} disabled={busy} className="size-4 accent-foreground" />
                {m.enabled ? 'Enabled' : 'Disabled'}
              </label>
              {!m.isDefault && (
                <button onClick={() => makeDefault(m)} disabled={busy} className="rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:bg-accent disabled:opacity-50">Set default</button>
              )}
              <button onClick={() => remove(m)} disabled={busy} aria-label="Delete" className="rounded-lg border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-50">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
