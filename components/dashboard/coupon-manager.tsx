'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Loader2, X, TicketPercent } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createCoupon, updateCoupon, deleteCoupon, type CouponInput } from '@/lib/actions/coupons';

type CouponType = 'PERCENT' | 'FIXED';
type CouponScope = 'ALL' | 'PRODUCTS' | 'SERVICES' | 'BOOKINGS';

export interface CouponRow {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  scope: CouponScope;
  minSubtotal: number | null;
  maxRedemptions: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

const SCOPES: { value: CouponScope; label: string }[] = [
  { value: 'ALL', label: 'Everything' },
  { value: 'PRODUCTS', label: 'Products' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'BOOKINGS', label: 'Bookings' },
];

interface FormState {
  code: string;
  type: CouponType;
  value: string;
  scope: CouponScope;
  minSubtotal: string;
  maxRedemptions: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  code: '',
  type: 'PERCENT',
  value: '',
  scope: 'ALL',
  minSubtotal: '',
  maxRedemptions: '',
  startsAt: '',
  expiresAt: '',
  isActive: true,
};

const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
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
  function openEdit(c: CouponRow) {
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      scope: c.scope,
      minSubtotal: c.minSubtotal != null ? String(c.minSubtotal) : '',
      maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : '',
      startsAt: dateOnly(c.startsAt),
      expiresAt: dateOnly(c.expiresAt),
      isActive: c.isActive,
    });
    setEditingId(c.id);
    setAdding(false);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    if (!form.code.trim()) return toast.error('Coupon code is required.');
    const payload: CouponInput = {
      code: form.code,
      type: form.type,
      value: Number(form.value) || 0,
      scope: form.scope,
      minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : null,
      maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
      isActive: form.isActive,
    };
    startSave(async () => {
      const res = editingId ? await updateCoupon(editingId, payload) : await createCoupon(payload);
      if (res.ok) {
        toast.success(editingId ? 'Coupon updated.' : 'Coupon created.');
        cancel();
        router.refresh();
      } else {
        toast.error(res.error === 'duplicate' ? 'That code already exists.' : 'Could not save the coupon.');
      }
    });
  }

  function remove(c: CouponRow) {
    if (!window.confirm(`Delete coupon “${c.code}”?`)) return;
    startSave(async () => {
      const res = await deleteCoupon(c.id);
      if (res.ok) {
        toast.success('Coupon deleted.');
        router.refresh();
      } else toast.error('Could not delete.');
    });
  }

  const fmtVal = (c: CouponRow) => (c.type === 'PERCENT' ? `${c.value}%` : `${c.value} SAR`);

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        New coupon
      </Button>

      <div className="grid gap-3">
        {coupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No coupons yet — create one to offer a discount on products, services, or bookings.
          </div>
        ) : (
          coupons.map((c) => {
            const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
            const live = c.isActive && !expired;
            return (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TicketPercent className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tabular-nums" dir="ltr">
                      {c.code}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {fmtVal(c)} · {SCOPES.find((s) => s.value === c.scope)?.label}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        live
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {expired ? 'Expired' : c.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    Used {c.usedCount}
                    {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                    {c.minSubtotal ? ` · min ${c.minSubtotal} SAR` : ''}
                    {c.expiresAt ? ` · ends ${dateOnly(c.expiresAt)}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(c)}
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
              <h2 className="text-lg font-semibold">{editingId ? 'Edit coupon' : 'New coupon'}</h2>
              <button onClick={cancel} disabled={saving} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input
                    autoFocus
                    dir="ltr"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="EID20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Applies to</Label>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value as CouponScope })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {SCOPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <div className="flex rounded-lg border p-0.5">
                    {(['PERCENT', 'FIXED'] as CouponType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, type: t })}
                        className={cn(
                          'flex-1 rounded-md py-1.5 text-xs font-medium transition',
                          form.type === t ? 'bg-foreground text-background' : 'text-muted-foreground'
                        )}
                      >
                        {t === 'PERCENT' ? 'Percent %' : 'Fixed SAR'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{form.type === 'PERCENT' ? 'Value (%)' : 'Value (SAR)'}</Label>
                  <Input
                    inputMode="numeric"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder={form.type === 'PERCENT' ? '20' : '50'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Min subtotal (optional)</Label>
                  <Input
                    inputMode="numeric"
                    value={form.minSubtotal}
                    onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Max uses (optional)</Label>
                  <Input
                    inputMode="numeric"
                    value={form.maxRedemptions}
                    onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Starts (optional)</Label>
                  <Input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expires (optional)</Label>
                  <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="size-4 rounded border"
                />
                Active
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !form.code.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Create coupon'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
