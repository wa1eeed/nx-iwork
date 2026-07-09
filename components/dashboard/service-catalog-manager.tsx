'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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

  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name ?? null;

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
    if (!form.title.trim()) return toast.error('Service name is required.');
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
      image: form.image || null,
      isActive: form.isActive,
    };
    startSave(async () => {
      const res = editingId ? await updateService(editingId, payload) : await createService(payload);
      if (res.ok) {
        toast.success(editingId ? 'Service updated.' : 'Service added.');
        cancel();
        router.refresh();
      } else toast.error('Could not save the service.');
    });
  }

  function remove(s: CatalogServiceRow) {
    if (!window.confirm(`Delete “${s.title}”?`)) return;
    startSave(async () => {
      const res = await deleteService(s.id);
      if (res.ok) {
        toast.success('Service deleted.');
        router.refresh();
      } else toast.error('Could not delete.');
    });
  }

  const priceText = (s: CatalogServiceRow) =>
    s.price != null ? `${s.price} SAR` : s.priceLabel || '—';

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        New service
      </Button>

      <div className="grid gap-3">
        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No services yet — add the services customers can book (e.g. Teeth whitening,
            Consultation), and group them under a clinic/section.
          </div>
        ) : (
          services.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{s.title}</p>
                  {deptName(s.departmentId) && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {deptName(s.departmentId)}
                    </span>
                  )}
                  {s.durationMin != null && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      {s.durationMin}m
                    </span>
                  )}
                  {!s.isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      Hidden
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.description}</p>
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
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && cancel()} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-[500px] overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit service' : 'New service'}</h2>
              <button onClick={cancel} disabled={saving} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Teeth whitening" />
              </div>

              <div className="space-y-1.5">
                <Label>Subtitle</Label>
                <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Short tagline under the title (optional)" />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What the customer gets — shown on the service detail page."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Clinic / section</Label>
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">— none —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Price (SAR)</Label>
                  <Input inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Optional" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Duration (min)</Label>
                  <Input inputMode="numeric" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder="Bookable if set" />
                </div>
                <div className="space-y-1.5">
                  <Label>Price label (optional)</Label>
                  <Input value={form.priceLabel} onChange={(e) => setForm({ ...form, priceLabel: e.target.value })} placeholder="e.g. From 200 SAR" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Image URL (optional)</Label>
                <Input dir="ltr" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.allowWaitlist} onChange={(e) => setForm({ ...form, allowWaitlist: e.target.checked })} className="size-4 rounded border" />
                  Allow waitlist when full
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="size-4 rounded border" />
                  Show on website
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Add service'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
