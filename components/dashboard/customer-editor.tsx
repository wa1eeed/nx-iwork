'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { feedback } from '@/lib/ui/feedback';
import { updateCustomer, deleteCustomer } from '@/lib/actions/customers';
import { STATUS } from '@/components/dashboard/customer-manager';

const ORDER = ['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST'] as const;
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export interface CustomerEditValues {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  notes: string;
}

export function CustomerEditor({ initial }: { initial: CustomerEditValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  function set<K extends keyof CustomerEditValues>(k: K, val: CustomerEditValues[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function save() {
    if (!v.name.trim()) return feedback('error', 'الاسم مطلوب.');
    startSave(async () => {
      const res = await updateCustomer(v.id, {
        name: v.name.trim(),
        phone: v.phone.trim() || null,
        email: v.email.trim() || null,
        status: v.status as (typeof ORDER)[number],
        notes: v.notes.trim() || null,
      });
      if (res.ok) {
        feedback(v.status === 'WON' ? 'success' : 'info', 'تم حفظ بيانات العميل.');
        router.refresh();
      } else {
        feedback('error', 'تعذّر الحفظ.');
      }
    });
  }

  function remove() {
    if (!window.confirm('حذف هذا العميل نهائياً؟')) return;
    startDelete(async () => {
      const res = await deleteCustomer(v.id);
      if (res.ok) {
        feedback('success', 'تم حذف العميل.');
        router.push('/customers');
        router.refresh();
      } else {
        feedback('error', 'تعذّر الحذف.');
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>الاسم</Label>
            <Input value={v.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>الحالة</Label>
            <select className={selectCls} value={v.status} onChange={(e) => set('status', e.target.value)}>
              {ORDER.map((s) => (
                <option key={s} value={s}>{STATUS[s].label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>الجوال</Label>
            <Input dir="ltr" value={v.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>البريد</Label>
            <Input dir="ltr" value={v.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>ملاحظات</Label>
          <Textarea rows={3} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={remove} disabled={deleting} className="text-destructive hover:text-destructive">
            {deleting ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <Trash2 className="me-1 h-4 w-4" />}حذف
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}حفظ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
