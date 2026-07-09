'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, Loader2, X, Sparkles, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { createService, updateService, deleteService, type ServiceInput } from '@/lib/actions/services';

export interface CatalogServiceRow {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  price: number | null;
  priceLabel: string | null;
  durationMin: number | null;
  allowWaitlist: boolean;
  waitlistCapacity: number;
  departmentId: string | null;
  image: string | null;
  isActive: boolean;
}

export interface DeptOption {
  id: string;
  name: string;
}

interface FormState {
  title: string;
  subtitle: string;
  description: string;
  departmentId: string;
  price: string;
  priceLabel: string;
  durationMin: string;
  maxCapacity: string;
  allowWaitlist: boolean;
  waitlistCapacity: string;
  image: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  title: '',
  subtitle: '',
  description: '',
  departmentId: '',
  price: '',
  priceLabel: '',
  durationMin: '',
  maxCapacity: '1',
  allowWaitlist: false,
  waitlistCapacity: '0',
  image: '',
  isActive: true,
};

export function ServiceCatalogManager({
  services,
  departments,
}: {
  services: CatalogServiceRow[];
  departments: DeptOption[];
}) {
  const t = useTranslations('svcMgr');
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, startSave] = useTransition();
  const showForm = adding || editingId !== null;

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && cancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, saving]);

  // Group services under their clinic/department (with an "Other" bucket last).
  const groups = [
    ...departments.map((d) => ({
      key: d.id,
      name: d.name,
      items: services.filter((s) => s.departmentId === d.id),
    })),
    {
      key: '__none',
      name: t('otherGroup'),
      items: services.filter((s) => !s.departmentId || !departments.some((d) => d.id === s.departmentId)),
    },
  ].filter((g) => g.items.length > 0);

  function openAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setAdding(true);
  }
  function openEdit(s: CatalogServiceRow) {
    setForm({
      title: s.title,
      subtitle: s.subtitle ?? '',
      description: s.description,
      departmentId: s.departmentId ?? '',
      price: s.price != null ? String(s.price) : '',
      priceLabel: s.priceLabel ?? '',
      durationMin: s.durationMin != null ? String(s.durationMin) : '',
      maxCapacity: '1',
      allowWaitlist: s.allowWaitlist,
      waitlistCapacity: String(s.waitlistCapacity ?? 0),
      image: s.image ?? '',
      isActive: s.isActive,
    });
    setEditingId(s.id);
    setAdding(false);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    if (!form.title.trim()) return toast.error(t('nameRequired'));
    const payload: ServiceInput = {
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description,
      departmentId: form.departmentId || null,
      price: form.price ? Number(form.price) : null,
      priceLabel: form.priceLabel || null,
      durationMin: form.durationMin ? Number(form.durationMin) : null,
      maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : 1,
      allowWaitlist: form.allowWaitlist,
      waitlistCapacity: form.waitlistCapacity ? Number(form.waitlistCapacity) : 0,
      image: form.image || null,
      isActive: form.isActive,
    };
    startSave(async () => {
      const res = editingId ? await updateService(editingId, payload) : await createService(payload);
      if (res.ok) {
        toast.success(editingId ? t('toastUpdated') : t('toastAdded'));
        cancel();
        router.refresh();
      } else toast.error(t('toastSaveError'));
    });
  }

  function remove(s: CatalogServiceRow) {
    if (!window.confirm(t('confirmDelete', { title: s.title }))) return;
    startSave(async () => {
      const res = await deleteService(s.id);
      if (res.ok) {
        toast.success(t('toastDeleted'));
        router.refresh();
      } else toast.error(t('toastDeleteError'));
    });
  }

  const priceText = (s: CatalogServiceRow) =>
    s.price != null ? `${s.price} SAR` : s.priceLabel || '—';

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        {t('newService')}
      </Button>

      {services.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('emptyState')}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h3 className="text-sm font-semibold">{g.name}</h3>
                <span className="text-xs text-muted-foreground">({g.items.length})</span>
              </div>
              <div className="grid gap-3">
                {g.items.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{s.title}</p>
                        {s.durationMin != null && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="size-3" />
                            {t('durationMinutes', { min: s.durationMin })}
                          </span>
                        )}
                        {!s.isActive && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {t('hidden')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.subtitle || s.description}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{priceText(s)}</p>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(s)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && cancel()} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-[500px] overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? t('editService') : t('newService')}</h2>
              <button onClick={cancel} disabled={saving} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label={t('cancel')}>
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('name')}</Label>
                <Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('namePlaceholder')} />
              </div>

              <div className="space-y-1.5">
                <Label>{t('subtitle')}</Label>
                <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder={t('subtitlePlaceholder')} />
              </div>

              <div className="space-y-1.5">
                <Label>{t('description')}</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t('descriptionPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('clinic')}</Label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">{t('noneOption')}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('price')}</Label>
                  <Input inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={t('pricePlaceholder')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('duration')}</Label>
                  <Input inputMode="numeric" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder={t('durationPlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('priceLabel')}</Label>
                  <Input value={form.priceLabel} onChange={(e) => setForm({ ...form, priceLabel: e.target.value })} placeholder={t('priceLabelPlaceholder')} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('imageUrl')}</Label>
                <Input dir="ltr" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.allowWaitlist} onChange={(e) => setForm({ ...form, allowWaitlist: e.target.checked })} className="size-4 rounded border" />
                  {t('allowWaitlist')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="size-4 rounded border" />
                  {t('showOnWebsite')}
                </label>
              </div>

              {form.allowWaitlist && (
                <div className="space-y-1.5">
                  <Label>{t('waitlistCapacity')}</Label>
                  <Input
                    inputMode="numeric"
                    value={form.waitlistCapacity}
                    onChange={(e) => setForm({ ...form, waitlistCapacity: e.target.value })}
                    placeholder="0"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button onClick={save} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? t('saveChanges') : t('addService')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
