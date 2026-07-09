'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, Loader2, X, Package2, Minus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustStock,
  type InventoryInput,
} from '@/lib/actions/inventory';

export interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: number | null;
  supplier: string | null;
  notes: string | null;
  isActive: boolean;
}

interface FormState {
  name: string;
  sku: string;
  unit: string;
  quantityOnHand: string;
  reorderLevel: string;
  unitCost: string;
  supplier: string;
  notes: string;
}

const EMPTY: FormState = {
  name: '',
  sku: '',
  unit: 'unit',
  quantityOnHand: '0',
  reorderLevel: '0',
  unitCost: '',
  supplier: '',
  notes: '',
};

export function InventoryManager({ items }: { items: InventoryRow[] }) {
  const t = useTranslations('invMgr');
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, startSave] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const showForm = adding || editingId !== null;

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && cancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, saving]);

  function openAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setAdding(true);
  }
  function openEdit(it: InventoryRow) {
    setForm({
      name: it.name,
      sku: it.sku ?? '',
      unit: it.unit,
      quantityOnHand: String(it.quantityOnHand),
      reorderLevel: String(it.reorderLevel),
      unitCost: it.unitCost != null ? String(it.unitCost) : '',
      supplier: it.supplier ?? '',
      notes: it.notes ?? '',
    });
    setEditingId(it.id);
    setAdding(false);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    if (!form.name.trim()) return toast.error(t('nameRequired'));
    const payload: InventoryInput = {
      name: form.name,
      sku: form.sku || null,
      unit: form.unit || 'unit',
      quantityOnHand: Number(form.quantityOnHand) || 0,
      reorderLevel: Number(form.reorderLevel) || 0,
      unitCost: form.unitCost ? Number(form.unitCost) : null,
      supplier: form.supplier || null,
      notes: form.notes || null,
    };
    startSave(async () => {
      const res = editingId
        ? await updateInventoryItem(editingId, payload)
        : await createInventoryItem(payload);
      if (res.ok) {
        toast.success(editingId ? t('toastUpdated') : t('toastAdded'));
        cancel();
        router.refresh();
      } else toast.error(t('saveError'));
    });
  }

  function remove(it: InventoryRow) {
    if (!window.confirm(t('confirmDelete', { name: it.name }))) return;
    startSave(async () => {
      const res = await deleteInventoryItem(it.id);
      if (res.ok) {
        toast.success(t('toastDeleted'));
        router.refresh();
      } else toast.error(t('deleteError'));
    });
  }

  function adjust(it: InventoryRow, delta: number) {
    setBusyId(it.id);
    startSave(async () => {
      const res = await adjustStock(it.id, delta);
      setBusyId(null);
      if (res.ok) router.refresh();
      else toast.error(t('adjustError'));
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        {t('newItem')}
      </Button>

      <div className="grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            {t('emptyState')}
          </div>
        ) : (
          items.map((it) => {
            const low = it.quantityOnHand <= it.reorderLevel;
            return (
              <div key={it.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl',
                    low ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {low ? <AlertTriangle className="h-5 w-5" /> : <Package2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{it.name}</p>
                    {low && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        {t('lowStock')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    {it.sku ? `${it.sku} · ` : ''}{t('reorderAt', { level: it.reorderLevel, unit: it.unit })}
                    {it.supplier ? ` · ${it.supplier}` : ''}
                  </p>
                </div>

                {/* Quick stock adjust. */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={saving && busyId === it.id}
                    onClick={() => adjust(it, -1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-14 text-center text-sm font-semibold tabular-nums">
                    {saving && busyId === it.id ? (
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    ) : (
                      `${it.quantityOnHand} ${it.unit}`
                    )}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={saving && busyId === it.id}
                    onClick={() => adjust(it, 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Button variant="ghost" size="icon" onClick={() => openEdit(it)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(it)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && cancel()} />
          <div className="relative z-10 w-full max-w-[460px] rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? t('editItem') : t('newItem')}</h2>
              <button onClick={cancel} disabled={saving} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label={t('cancel')}>
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('name')}</Label>
                <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('namePlaceholder')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('sku')}</Label>
                  <Input dir="ltr" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('unit')}</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t('unitPlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('unitCost')}</Label>
                  <Input inputMode="numeric" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} placeholder={t('unitCostPlaceholder')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('quantityOnHand')}</Label>
                  <Input inputMode="numeric" value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('reorderLevel')}</Label>
                  <Input inputMode="numeric" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t('supplier')}</Label>
                <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="—" />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button onClick={save} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? t('saveChanges') : t('addItem')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
