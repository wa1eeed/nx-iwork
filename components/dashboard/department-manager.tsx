'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Headphones,
  Megaphone,
  PenTool,
  Search,
  ShoppingCart,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '@/lib/actions/departments';

export interface DepartmentRow {
  id: string;
  name: string;
  nameEn: string | null;
  icon: string;
  color: string;
  description: string | null;
  landingVisible: boolean;
  tagline: string | null;
  serviceCount: number;
  agentCount: number;
}

// Small fixed icon set keeps rendering simple (no dynamic icon imports).
const ICONS = {
  briefcase: Briefcase,
  headphones: Headphones,
  megaphone: Megaphone,
  'pen-tool': PenTool,
  search: Search,
  cart: ShoppingCart,
} as const;
type IconKey = keyof typeof ICONS;

// Warm hue swatches aligned to the per-department accent system.
const COLORS = [
  '#16a34a', // green — Sales
  '#f59e0b', // amber — Marketing
  '#a855f7', // purple — Support
  '#0ea5e9', // sky — Operations
  '#ca8a04', // gold — Finance
  '#6366f1', // indigo — Appointments
  '#ec4899', // pink
  '#14b8a6', // teal
];

function DeptIcon({ icon, className }: { icon: string; className?: string }) {
  const Cmp = ICONS[icon as IconKey] ?? Briefcase;
  return <Cmp className={className} />;
}

interface FormState {
  name: string;
  nameEn: string;
  icon: IconKey;
  color: string;
  description: string;
  landingVisible: boolean;
  tagline: string;
}

const EMPTY: FormState = {
  name: '',
  nameEn: '',
  icon: 'briefcase',
  color: COLORS[0],
  description: '',
  landingVisible: true,
  tagline: '',
};

export function DepartmentManager({ departments }: { departments: DepartmentRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, startSave] = useTransition();

  const showForm = adding || editingId !== null;

  // Close the modal on Escape.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, saving]);

  function openAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setAdding(true);
  }

  function openEdit(d: DepartmentRow) {
    setForm({
      name: d.name,
      nameEn: d.nameEn ?? '',
      icon: (d.icon as IconKey) in ICONS ? (d.icon as IconKey) : 'briefcase',
      color: d.color,
      description: d.description ?? '',
      landingVisible: d.landingVisible,
      tagline: d.tagline ?? '',
    });
    setEditingId(d.id);
    setAdding(false);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || null,
      icon: form.icon,
      color: form.color,
      description: form.description.trim() || null,
      landingVisible: form.landingVisible,
      tagline: form.tagline.trim() || null,
    };
    startSave(async () => {
      const res = editingId
        ? await updateDepartment(editingId, payload)
        : await createDepartment(payload);
      if (res.ok) {
        toast.success(editingId ? 'Department updated.' : 'Department created.');
        cancel();
        router.refresh();
      } else {
        toast.error('Could not save the department.');
      }
    });
  }

  function remove(d: DepartmentRow) {
    if (d.agentCount > 0) return toast.error('Move or remove this department’s agents first.');
    if (!window.confirm(`Delete the “${d.name}” department?`)) return;
    startSave(async () => {
      const res = await deleteDepartment(d.id);
      if (res.ok) {
        toast.success('Department deleted.');
        router.refresh();
      } else {
        toast.error(res.error === 'has_agents' ? 'This department still has agents.' : 'Could not delete.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        New department
      </Button>

      {/* Department list. */}
      <div className="grid gap-3">
        {departments.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No departments yet — create one to start organizing your workforce.
          </div>
        ) : (
          departments.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: d.color }}
                >
                  <DeptIcon icon={d.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{d.name}</p>
                    {d.landingVisible && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        On website
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.serviceCount} service{d.serviceCount === 1 ? '' : 's'} · {d.agentCount} agent
                    {d.agentCount === 1 ? '' : 's'}
                    {d.tagline ? ` · ${d.tagline}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(d)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* New / edit department modal (design Modal B). */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && cancel()} />
          <div className="relative z-10 w-full max-w-[440px] rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Edit department' : 'New department'}
              </h2>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && form.name.trim() && !saving) save();
                  }}
                  placeholder="e.g. Sales"
                />
              </div>

              {/* Color hue swatches — 34px circles, ink ring on the selected. */}
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2.5">
                  {COLORS.map((c) => {
                    const sel = form.color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        aria-label={c}
                        aria-pressed={sel}
                        className={cn(
                          'size-[34px] rounded-full transition',
                          sel
                            ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card'
                            : 'hover:scale-105'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Icon — secondary, shown on the department card. */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ICONS) as IconKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, icon: key })}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg border transition',
                        form.icon === key ? 'border-foreground bg-muted' : 'hover:bg-muted'
                      )}
                    >
                      <DeptIcon icon={key} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Landing page — a department doubles as a clinic/category section. */}
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <label className="flex items-center justify-between gap-2 text-sm font-medium">
                  Show as a section on your website
                  <input
                    type="checkbox"
                    checked={form.landingVisible}
                    onChange={(e) => setForm({ ...form, landingVisible: e.target.checked })}
                    className="size-4 rounded border"
                  />
                </label>
                <Input
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Tagline — e.g. Modern dental care for the whole family"
                />
                <p className="text-[11px] text-muted-foreground">
                  Its services appear as cards under this section on your public site.
                </p>
              </div>

              {/* Optional details. */}
              <details className="group">
                <summary className="cursor-pointer select-none text-xs text-muted-foreground">
                  More options
                </summary>
                <div className="mt-3 space-y-3">
                  <Input
                    dir="ltr"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    placeholder="English name (optional)"
                  />
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Description (optional)"
                  />
                </div>
              </details>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Create department'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
