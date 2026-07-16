'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Loader2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { feedback } from '@/lib/ui/feedback';
import { updateAgentKpis } from '@/lib/actions/agents';

export interface KpiRow {
  key: string;
  label: string;
  target: number;
  unit: string;
}

// Owner-editable KPI targets for one agent. Archetypes/templates only SEED
// these; this editor is how the owner tunes what "good" means for the role.
export function AgentKpisEditor({ agentId, initial }: { agentId: string; initial: KpiRow[] }) {
  const t = useTranslations('agentKpis');
  const router = useRouter();
  const [rows, setRows] = useState<KpiRow[]>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();

  function set(i: number, patch: Partial<KpiRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  }
  function add() {
    setRows((prev) => [...prev, { key: `kpi_${prev.length + 1}_${prev.map((r) => r.key).join(',').length}`, label: '', target: 0, unit: '' }]);
    setDirty(true);
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
    setDirty(true);
  }

  function save() {
    const clean = rows
      .map((r) => ({ ...r, label: r.label.trim(), unit: r.unit.trim() }))
      .filter((r) => r.label);
    start(async () => {
      const res = await updateAgentKpis(agentId, clean);
      if (res.ok) {
        feedback('success', t('saved'));
        setRows(clean);
        setDirty(false);
        router.refresh();
      } else {
        feedback('error', t('saveError'));
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Target className="dept-accent-text h-4 w-4" />
            {t('title')}
          </p>
          <Button size="sm" variant="outline" onClick={add} disabled={saving || rows.length >= 8}>
            <Plus className="me-1 h-4 w-4" />
            {t('add')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('help')}</p>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="space-y-2">
            {/* Column labels (visually align with the row grid below). */}
            <div className="hidden grid-cols-[1fr_7rem_5.5rem_2.25rem] gap-2 text-[11px] text-muted-foreground sm:grid">
              <span>{t('label')}</span>
              <span>{t('target')}</span>
              <span>{t('unit')}</span>
              <span />
            </div>
            {rows.map((k, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_7rem_5.5rem_2.25rem]">
                <Input
                  value={k.label}
                  onChange={(e) => set(i, { label: e.target.value })}
                  placeholder={t('labelPlaceholder')}
                  dir="auto"
                  className="col-span-2 sm:col-span-1"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={Number.isFinite(k.target) ? k.target : 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    set(i, { target: Number.isFinite(n) ? Math.max(0, n) : 0 });
                  }}
                  dir="ltr"
                />
                <Input value={k.unit} onChange={(e) => set(i, { unit: e.target.value })} placeholder={t('unitPlaceholder')} dir="auto" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  className="text-destructive hover:text-destructive"
                  aria-label={t('remove')}
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {dirty && (
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
