'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Loader2, X, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createStaff, updateStaff, deleteStaff, type StaffInput } from '@/lib/actions/staff';

type CommissionType = 'PERCENT_SALES' | 'FIXED_PER_ORDER' | 'TARGET_BONUS';

export interface StaffRow {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  commissionType: CommissionType;
  commissionRate: number;
  monthlyTarget: number | null;
  isActive: boolean;
}

const TYPES: { value: CommissionType; label: string }[] = [
  { value: 'PERCENT_SALES', label: '% of sales' },
  { value: 'FIXED_PER_ORDER', label: 'Per order' },
  { value: 'TARGET_BONUS', label: 'Target bonus' },
];

function rateLabel(t: CommissionType) {
  if (t === 'PERCENT_SALES') return 'Rate (%)';
  if (t === 'FIXED_PER_ORDER') return 'Amount / order (SAR)';
  return 'Bonus (SAR)';
}

export function commissionSummary(row: {
  commissionType: CommissionType;
  commissionRate: number;
  monthlyTarget: number | null;
}) {
  if (row.commissionType === 'PERCENT_SALES') return `${row.commissionRate}% of sales`;
  if (row.commissionType === 'FIXED_PER_ORDER') return `${row.commissionRate} SAR / order`;
  return `${row.commissionRate} SAR at ${row.monthlyTarget ?? 0} SAR target`;
}

interface FormState {
  name: string;
  role: string;
  phone: string;
  email: string;
  commissionType: CommissionType;
  commissionRate: string;
  monthlyTarget: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: '',
  role: '',
  phone: '',
  email: '',
  commissionType: 'PERCENT_SALES',
  commissionRate: '',
  monthlyTarget: '',
  isActive: true,
};

export function StaffManager({ staff }: { staff: StaffRow[] }) {
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

  function openAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setAdding(true);
  }
  function openEdit(s: StaffRow) {
    setForm({
      name: s.name,
      role: s.role ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      commissionType: s.commissionType,
      commissionRate: String(s.commissionRate),
      monthlyTarget: s.monthlyTarget != null ? String(s.monthlyTarget) : '',
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
    if (!form.name.trim()) return toast.error('Name is required.');
    const payload: StaffInput = {
      name: form.name,
      role: form.role || null,
      phone: form.phone || null,
      email: form.email || null,
      commissionType: form.commissionType,
      commissionRate: Number(form.commissionRate) || 0,
      monthlyTarget: form.monthlyTarget ? Number(form.monthlyTarget) : null,
      isActive: form.isActive,
    };
    startSave(async () => {
      const res = editingId ? await updateStaff(editingId, payload) : await createStaff(payload);
      if (res.ok) {
        toast.success(editingId ? 'Staff updated.' : 'Staff added.');
        cancel();
        router.refresh();
      } else toast.error('Could not save.');
    });
  }

  function remove(s: StaffRow) {
    if (!window.confirm(`Remove “${s.name}”? Their past orders/bookings stay, unattributed.`)) return;
    startSave(async () => {
      const res = await deleteStaff(s.id);
      if (res.ok) {
        toast.success('Staff removed.');
        router.refresh();
      } else toast.error('Could not remove.');
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        New staff member
      </Button>

      <div className="grid gap-3">
        {staff.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No staff yet — add the people who deliver your services, then set how they earn commission.
          </div>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{s.name}</p>
                  {s.role && <span className="text-xs text-muted-foreground">{s.role}</span>}
                  {!s.isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Inactive</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{commissionSummary(s)}</p>
              </div>
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
          <div className="relative z-10 w-full max-w-[460px] rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit staff member' : 'New staff member'}</h2>
              <button onClick={cancel} disabled={saving} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dr. Sara" />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Dentist" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="—" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Commission</Label>
                <div className="flex rounded-lg border p-0.5">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, commissionType: t.value })}
                      className={cn(
                        'flex-1 rounded-md py-1.5 text-xs font-medium transition',
                        form.commissionType === t.value ? 'bg-foreground text-background' : 'text-muted-foreground'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{rateLabel(form.commissionType)}</Label>
                  <Input inputMode="numeric" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Monthly target (SAR)</Label>
                  <Input inputMode="numeric" value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} placeholder="—" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="size-4 rounded border" />
                Active
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Add staff'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
