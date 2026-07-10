'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { feedback } from '@/lib/ui/feedback';
import { updateCustomer, deleteCustomer } from '@/lib/actions/customers';
import { STATUS_ORDER } from '@/components/dashboard/customer-manager';
import { useConfirm } from '@/components/ui/confirm-dialog';

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
  const t = useTranslations('crm');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  function set<K extends keyof CustomerEditValues>(k: K, val: CustomerEditValues[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function save() {
    if (!v.name.trim()) return feedback('error', t('nameRequired'));
    startSave(async () => {
      const res = await updateCustomer(v.id, {
        name: v.name.trim(),
        phone: v.phone.trim() || null,
        email: v.email.trim() || null,
        status: v.status as (typeof STATUS_ORDER)[number],
        notes: v.notes.trim() || null,
      });
      if (res.ok) {
        feedback(v.status === 'WON' ? 'success' : 'info', t('saved'));
        router.refresh();
      } else {
        feedback('error', t('saveFailed'));
      }
    });
  }

  async function remove() {
    if (!(await confirm({ title: t('deleteConfirm'), destructive: true, confirmLabel: tc('delete'), cancelLabel: tc('cancel') }))) return;
    startDelete(async () => {
      const res = await deleteCustomer(v.id);
      if (res.ok) {
        feedback('success', t('deleted'));
        router.push('/customers');
        router.refresh();
      } else {
        feedback('error', t('deleteFailed'));
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>{t('name')}</Label>
            <Input value={v.name} onChange={(e) => set('name', e.target.value)} dir="auto" />
          </div>
          <div className="space-y-1">
            <Label>{t('statusAria')}</Label>
            <select className={selectCls} value={v.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{t(`status.${s}`)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>{t('phone')}</Label>
            <Input dir="ltr" value={v.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t('email')}</Label>
            <Input dir="ltr" value={v.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>{t('notes')}</Label>
          <Textarea rows={3} value={v.notes} onChange={(e) => set('notes', e.target.value)} dir="auto" />
        </div>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={remove} disabled={deleting} className="text-destructive hover:text-destructive">
            {deleting ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <Trash2 className="me-1 h-4 w-4" />}{tc('delete')}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}{tc('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
