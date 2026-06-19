'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { createTrigger, toggleTrigger, deleteTrigger } from '@/lib/actions/knowledge';

export interface TriggerRow {
  id: string;
  event: string;
  name: string;
  agentName: string | null;
  isActive: boolean;
  fireCount: number;
}

const EVENTS: { value: 'LEAD_CREATED' | 'ORDER_CREATED' | 'ORDER_PAID'; label: string }[] = [
  { value: 'LEAD_CREATED', label: 'عميل جديد في الـ CRM' },
  { value: 'ORDER_CREATED', label: 'طلب جديد' },
  { value: 'ORDER_PAID', label: 'فاتورة مدفوعة' },
];
const EVENT_LABEL = Object.fromEntries(EVENTS.map((e) => [e.value, e.label]));
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function TriggerManager({
  triggers,
  agents,
}: {
  triggers: TriggerRow[];
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [event, setEvent] = useState<TriggerRow['event']>('LEAD_CREATED');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [name, setName] = useState('');
  const [taskTemplate, setTaskTemplate] = useState('');
  const [saving, start] = useTransition();

  function save() {
    if (!name.trim()) return toast.error('اسم المشغّل مطلوب.');
    if (!agentId) return toast.error('اختر الموظف.');
    if (!taskTemplate.trim()) return toast.error('اكتب المهمة المطلوبة.');
    start(async () => {
      const res = await createTrigger({
        event: event as 'LEAD_CREATED' | 'ORDER_CREATED' | 'ORDER_PAID',
        agentId,
        name: name.trim(),
        taskTemplate: taskTemplate.trim(),
        isActive: true,
      });
      if (res.ok) {
        toast.success('تمت إضافة المشغّل.');
        setName('');
        setTaskTemplate('');
        setAdding(false);
        router.refresh();
      } else toast.error('تعذّرت الإضافة.');
    });
  }

  function toggle(id: string, isActive: boolean) {
    start(async () => {
      const res = await toggleTrigger(id, isActive);
      if (res.ok) router.refresh();
      else toast.error('تعذّر التحديث.');
    });
  }

  function remove(id: string) {
    if (!window.confirm('حذف هذا المشغّل؟')) return;
    start(async () => {
      const res = await deleteTrigger(id);
      if (res.ok) {
        toast.success('تم الحذف.');
        router.refresh();
      } else toast.error('تعذّر الحذف.');
    });
  }

  return (
    <div className="space-y-3">
      {!adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={agents.length === 0}>
          <Plus className="me-1 h-4 w-4" />
          مشغّل جديد
        </Button>
      )}
      {agents.length === 0 && (
        <p className="text-sm text-muted-foreground">أنشئ موظفاً أولاً.</p>
      )}

      {adding && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>عند الحدث</Label>
                <select className={selectCls} value={event} onChange={(e) => setEvent(e.target.value)}>
                  {EVENTS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>يصحى الموظف</Label>
                <select className={selectCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>اسم المشغّل</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: متابعة العميل الجديد" />
            </div>
            <div className="space-y-1">
              <Label>المهمة التي ينفّذها</Label>
              <Textarea rows={2} value={taskTemplate} onChange={(e) => setTaskTemplate(e.target.value)} placeholder="تواصل مع العميل الجديد وجهّز عرضاً مناسباً." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving}>إلغاء</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {triggers.length === 0 && !adding && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          لا مشغّلات. اجعل وكيلاً يتحرك تلقائياً عند حدث (مثل: عميل جديد → يصحى وكيل المبيعات).
        </p>
      )}

      {triggers.map((t) => (
        <Card key={t.id}>
          <CardContent className="flex items-center gap-3 p-4">
            <Zap className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {EVENT_LABEL[t.event] ?? t.event} → {t.agentName ?? '—'} · نُفّذ {t.fireCount} مرة
              </p>
            </div>
            <Switch checked={t.isActive} onCheckedChange={(c) => toggle(t.id, c)} disabled={saving} />
            <Button variant="ghost" size="icon" onClick={() => remove(t.id)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
