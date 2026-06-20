'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { feedback } from '@/lib/ui/feedback';
import { createTrigger, toggleTrigger, deleteTrigger } from '@/lib/actions/knowledge';

export interface ScenarioRow {
  id: string;
  event: string;
  name: string;
  isActive: boolean;
  fireCount: number;
}

const EVENTS: { value: 'LEAD_CREATED' | 'ORDER_CREATED' | 'ORDER_PAID'; label: string }[] = [
  { value: 'LEAD_CREATED', label: 'عند ورود عميل/استفسار جديد' },
  { value: 'ORDER_CREATED', label: 'عند ورود طلب جديد' },
  { value: 'ORDER_PAID', label: 'عند دفع فاتورة' },
];
const EVENT_LABEL = Object.fromEntries(EVENTS.map((e) => [e.value, e.label]));
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

// Per-agent "playbook": configure how THIS agent reacts to business events.
export function AgentScenarios({ agentId, scenarios }: { agentId: string; scenarios: ScenarioRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [event, setEvent] = useState<ScenarioRow['event']>('LEAD_CREATED');
  const [name, setName] = useState('');
  const [taskTemplate, setTaskTemplate] = useState('');
  const [pending, start] = useTransition();

  function save() {
    if (!name.trim()) return feedback('error', 'اسم السيناريو مطلوب.');
    if (!taskTemplate.trim()) return feedback('error', 'اكتب ما يفعله الوكيل.');
    start(async () => {
      const res = await createTrigger({
        event: event as 'LEAD_CREATED' | 'ORDER_CREATED' | 'ORDER_PAID',
        agentId,
        name: name.trim(),
        taskTemplate: taskTemplate.trim(),
        isActive: true,
      });
      if (res.ok) {
        feedback('success', 'تمت إضافة السيناريو.');
        setName('');
        setTaskTemplate('');
        setAdding(false);
        router.refresh();
      } else feedback('error', 'تعذّرت الإضافة.');
    });
  }

  function toggle(id: string, isActive: boolean) {
    start(async () => {
      const res = await toggleTrigger(id, isActive);
      if (res.ok) router.refresh();
      else feedback('error', 'تعذّر التحديث.');
    });
  }

  function remove(id: string) {
    if (!window.confirm('حذف هذا السيناريو؟')) return;
    start(async () => {
      const res = await deleteTrigger(id);
      if (res.ok) {
        feedback('success', 'تم الحذف.');
        router.refresh();
      } else feedback('error', 'تعذّر الحذف.');
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">السيناريوهات (قواعد التحرّك التلقائي)</p>
            <p className="text-xs text-muted-foreground">
              عرّف ماذا يفعل هذا الموظف تلقائياً عند حدوث حدث في عملك.
            </p>
          </div>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="me-1 h-4 w-4" />سيناريو
            </Button>
          )}
        </div>

        {adding && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="space-y-1">
              <Label>متى؟</Label>
              <select className={selectCls} value={event} onChange={(e) => setEvent(e.target.value)}>
                {EVENTS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>اسم السيناريو</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثل: متابعة العميل الجديد" />
            </div>
            <div className="space-y-1">
              <Label>ماذا يفعل الوكيل؟</Label>
              <Textarea rows={2} value={taskTemplate} onChange={(e) => setTaskTemplate(e.target.value)} placeholder="تواصل مع العميل، افهم احتياجه، وجهّز عرضاً مناسباً." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={pending}>إلغاء</Button>
              <Button size="sm" onClick={save} disabled={pending}>
                {pending && <Loader2 className="me-1 h-4 w-4 animate-spin" />}حفظ
              </Button>
            </div>
          </div>
        )}

        {scenarios.length === 0 && !adding ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            لا سيناريوهات. أضف قاعدة ليتحرّك الموظف تلقائياً عند الأحداث.
          </p>
        ) : (
          <div className="space-y-2">
            {scenarios.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
                <Zap className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {EVENT_LABEL[s.event] ?? s.event} · نُفّذ {s.fireCount} مرة
                  </p>
                </div>
                <Switch checked={s.isActive} onCheckedChange={(c) => toggle(s.id, c)} disabled={pending} />
                <Button variant="ghost" size="icon" onClick={() => remove(s.id)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
