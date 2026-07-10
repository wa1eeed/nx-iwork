'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, Loader2, X, UserRound, ArrowUpRight } from 'lucide-react';
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
  bio: string | null;
  image: string | null;
  phone: string | null;
  email: string | null;
  commissionType: CommissionType;
  commissionRate: number;
  monthlyTarget: number | null;
  isActive: boolean;
}

type Translator = (key: string, values?: Record<string, string | number>) => string;

const TYPE_VALUES: { value: CommissionType; labelKey: string }[] = [
  { value: 'PERCENT_SALES', labelKey: 'typePercentSales' },
  { value: 'FIXED_PER_ORDER', labelKey: 'typePerOrder' },
  { value: 'TARGET_BONUS', labelKey: 'typeTargetBonus' },
];

function rateLabel(t: Translator, type: CommissionType) {
  if (type === 'PERCENT_SALES') return t('rateLabelPercent');
  if (type === 'FIXED_PER_ORDER') return t('rateLabelPerOrder');
  return t('rateLabelBonus');
}

// Exported + used by the commissions page too, so it takes a translator (the
// caller passes its own staffMgr translator).
export function commissionSummary(
  row: { commissionType: CommissionType; commissionRate: number; monthlyTarget: number | null },
  t: Translator
) {
  if (row.commissionType === 'PERCENT_SALES') return t('summaryPercent', { rate: row.commissionRate });
  if (row.commissionType === 'FIXED_PER_ORDER') return t('summaryPerOrder', { rate: row.commissionRate });
  return t('summaryTargetBonus', { rate: row.commissionRate, target: row.monthlyTarget ?? 0 });
}

interface FormState {
  name: string;
  role: string;
  bio: string;
  image: string;
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
  bio: '',
  image: '',
  phone: '',
  email: '',
  commissionType: 'PERCENT_SALES',
  commissionRate: '',
  monthlyTarget: '',
  isActive: true,
};

export function StaffManager({ staff }: { staff: StaffRow[] }) {
  const t = useTranslations('staffMgr');
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
      bio: s.bio ?? '',
      image: s.image ?? '',
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
    if (!form.name.trim()) return toast.error(t('errNameRequired'));
    const payload: StaffInput = {
      name: form.name,
      role: form.role || null,
      bio: form.bio || null,
      image: form.image || null,
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
        toast.success(editingId ? t('toastUpdated') : t('toastAdded'));
        cancel();
        router.refresh();
      } else toast.error(t('toastSaveError'));
    });
  }

  function remove(s: StaffRow) {
    if (!window.confirm(t('confirmRemove', { name: s.name }))) return;
    startSave(async () => {
      const res = await deleteStaff(s.id);
      if (res.ok) {
        toast.success(t('toastRemoved'));
        router.refresh();
      } else toast.error(t('toastRemoveError'));
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        {t('newStaff')}
      </Button>

      <div className="grid gap-3">
        {staff.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            {t('emptyState')}
          </div>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt={s.name} className="h-11 w-11 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <UserRound className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/staff/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                  {s.role && <span className="text-xs text-muted-foreground">{s.role}</span>}
                  {!s.isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t('inactive')}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{commissionSummary(s, t)}</p>
              </div>
              <Link
                href={`/staff/${s.id}`}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={t('profile')}
              >
                <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
              </Link>
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
          <div className="relative z-10 max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? t('editStaff') : t('newStaff')}</h2>
              <button onClick={cancel} disabled={saving} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label={t('cancel')}>
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('name')}</Label>
                  <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('namePlaceholder')} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('role')}</Label>
                  <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder={t('rolePlaceholder')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('phone')}</Label>
                  <Input dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('email')}</Label>
                  <Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="—" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('photoUrl')}</Label>
                <Input dir="ltr" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label>{t('bio')}</Label>
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder={t('bioPlaceholder')}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('commission')}</Label>
                <div className="flex rounded-lg border p-0.5">
                  {TYPE_VALUES.map((ct) => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => setForm({ ...form, commissionType: ct.value })}
                      className={cn(
                        'flex-1 rounded-md py-1.5 text-xs font-medium transition',
                        form.commissionType === ct.value ? 'bg-foreground text-background' : 'text-muted-foreground'
                      )}
                    >
                      {t(ct.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{rateLabel(t, form.commissionType)}</Label>
                  <Input inputMode="numeric" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('monthlyTarget')}</Label>
                  <Input inputMode="numeric" value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} placeholder="—" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="size-4 rounded border" />
                {t('active')}
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button onClick={save} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? t('saveChanges') : t('addStaff')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
