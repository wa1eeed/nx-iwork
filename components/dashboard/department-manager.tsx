'use client';

import { useState, useTransition } from 'react';
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

const COLORS = ['#06b6d4', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

function DeptIcon({ icon, className }: { icon: string; className?: string }) {
  const Cmp = ICONS[(icon as IconKey)] ?? Briefcase;
  return <Cmp className={className} />;
}

interface FormState {
  name: string;
  nameEn: string;
  icon: IconKey;
  color: string;
  description: string;
}

const EMPTY: FormState = {
  name: '',
  nameEn: '',
  icon: 'briefcase',
  color: COLORS[0],
  description: '',
};

export function DepartmentManager({ departments }: { departments: DepartmentRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, startSave] = useTransition();

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
    });
    setEditingId(d.id);
    setAdding(false);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    if (!form.name.trim()) return toast.error('اسم القسم مطلوب.');
    const payload = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || null,
      icon: form.icon,
      color: form.color,
      description: form.description.trim() || null,
    };
    startSave(async () => {
      const res = editingId
        ? await updateDepartment(editingId, payload)
        : await createDepartment(payload);
      if (res.ok) {
        toast.success('تم الحفظ.');
        cancel();
        router.refresh();
      } else {
        toast.error('تعذّر الحفظ.');
      }
    });
  }

  function remove(d: DepartmentRow) {
    if (d.agentCount > 0)
      return toast.error('انقل أو احذف موظفي هذا القسم أولاً.');
    if (!window.confirm(`حذف قسم "${d.name}"؟`)) return;
    startSave(async () => {
      const res = await deleteDepartment(d.id);
      if (res.ok) {
        toast.success('تم الحذف.');
        router.refresh();
      } else {
        toast.error(res.error === 'has_agents' ? 'القسم فيه موظفون.' : 'تعذّر الحذف.');
      }
    });
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={openAdd}>
          <Plus className="me-1 h-4 w-4" />
          قسم جديد
        </Button>
      )}

      {showForm && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>اسم القسم *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="مثل: المبيعات"
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
                <Input
                  dir="ltr"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="Sales"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الأيقونة</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ICONS) as IconKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, icon: key })}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg border',
                      form.icon === key ? 'border-primary ring-1 ring-primary' : 'hover:bg-muted'
                    )}
                  >
                    <DeptIcon icon={key} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>اللون</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={cn(
                      'h-8 w-8 rounded-full border-2',
                      form.color === c ? 'border-foreground' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>وصف (اختياري)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                إلغاء
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {departments.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: d.color }}
              >
                <DeptIcon icon={d.icon} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.agentCount} موظف{d.description ? ` · ${d.description}` : ''}
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
        ))}
      </div>
    </div>
  );
}
