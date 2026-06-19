'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createAgent, updateAgent } from '@/lib/actions/agents';
import type { AgentInput } from '@/lib/validators/agents';

export interface AgentFormValues {
  id?: string;
  name: string;
  nameEn: string;
  role: string;
  roleEn: string;
  persona: string;
  departmentId: string;
  parentId: string;
  model: 'HAIKU' | 'SONNET' | 'OPUS';
  temperature: number;
  systemPrompt: string;
}

const MODELS: { value: AgentFormValues['model']; label: string; hint: string }[] = [
  { value: 'HAIKU', label: 'سريع واقتصادي', hint: 'الأفضل لخدمة العملاء والردود السريعة' },
  { value: 'SONNET', label: 'متوازن', hint: 'تفكير أعمق واستخدام الأدوات' },
  { value: 'OPUS', label: 'متقدم', hint: 'المهام المعقّدة والتحليل' },
];

const DEFAULTS: AgentFormValues = {
  name: '',
  nameEn: '',
  role: '',
  roleEn: '',
  persona: '',
  departmentId: '',
  parentId: '',
  model: 'HAIKU',
  temperature: 0.6,
  systemPrompt: '',
};

export function AgentForm({
  departments,
  managers,
  initial,
}: {
  departments: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  initial?: AgentFormValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<AgentFormValues>(
    initial ?? { ...DEFAULTS, departmentId: departments[0]?.id ?? '' }
  );
  const [saving, startSave] = useTransition();
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof AgentFormValues>(k: K, val: AgentFormValues[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function submit() {
    if (!v.name.trim()) return toast.error('اسم الموظف مطلوب.');
    if (!v.role.trim()) return toast.error('المسمّى الوظيفي مطلوب.');
    if (!v.departmentId) return toast.error('اختر القسم.');
    if (!v.persona.trim()) return toast.error('اكتب شخصية الموظف.');

    const payload: AgentInput = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      role: v.role.trim(),
      roleEn: v.roleEn.trim() || null,
      persona: v.persona.trim(),
      departmentId: v.departmentId,
      parentId: v.parentId || null,
      model: v.model,
      temperature: v.temperature,
      maxTokens: 4096,
      systemPrompt: v.systemPrompt.trim() || null,
    };

    startSave(async () => {
      const res = isEdit
        ? await updateAgent(initial!.id!, payload)
        : await createAgent(payload);
      if (res.ok) {
        toast.success(isEdit ? 'تم حفظ الموظف.' : 'تم إنشاء الموظف.');
        router.push('/agents');
        router.refresh();
      } else if (res.error === 'bad_department') {
        toast.error('القسم أو المدير غير صحيح.');
      } else {
        toast.error('تعذّر الحفظ.');
      }
    });
  }

  const selectCls =
    'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الهوية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الاسم *</Label>
              <Input value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="مثل: سُهى" />
            </div>
            <div className="space-y-2">
              <Label>الاسم بالإنجليزية</Label>
              <Input dir="ltr" value={v.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>المسمّى الوظيفي *</Label>
              <Input value={v.role} onChange={(e) => set('role', e.target.value)} placeholder="مثل: موظف مبيعات" />
            </div>
            <div className="space-y-2">
              <Label>القسم *</Label>
              {departments.length === 0 ? (
                <p className="pt-2 text-sm text-destructive">أنشئ قسماً أولاً.</p>
              ) : (
                <select
                  className={selectCls}
                  value={v.departmentId}
                  onChange={(e) => set('departmentId', e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الشخصية والسلوك</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>الشخصية والأسلوب *</Label>
            <Textarea
              rows={5}
              value={v.persona}
              onChange={(e) => set('persona', e.target.value)}
              placeholder="من هو هذا الموظف؟ كيف يتكلّم؟ ما الذي يهتم به؟ مثال: موظفة خدمة عملاء ودودة، تجيب باختصار ووضوح، وتحرص على راحة العميل."
            />
            <p className="text-xs text-muted-foreground">
              هذي شخصيته الأساسية. كلما كانت أوضح، كان أداؤه أدق.
            </p>
          </div>
          <div className="space-y-2">
            <Label>تعليمات إضافية (اختياري)</Label>
            <Textarea
              rows={3}
              value={v.systemPrompt}
              onChange={(e) => set('systemPrompt', e.target.value)}
              placeholder="قواعد أو ممنوعات محددة، مثل: لا تعطِ خصومات أكثر من 10%."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الذكاء والإعدادات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>مستوى النموذج</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => set('model', m.value)}
                  className={
                    'rounded-lg border p-3 text-right ' +
                    (v.model === m.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-muted')
                  }
                >
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{m.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>الإبداع ({v.temperature})</Label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={v.temperature}
                onChange={(e) => set('temperature', Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                أقل = دقيق وثابت · أعلى = أكثر تنوّعاً
              </p>
            </div>
            <div className="space-y-2">
              <Label>المدير المباشر (اختياري)</Label>
              <select
                className={selectCls}
                value={v.parentId}
                onChange={(e) => set('parentId', e.target.value)}
              >
                <option value="">بدون</option>
                {managers
                  .filter((m) => m.id !== initial?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push('/agents')} disabled={saving}>
          إلغاء
        </Button>
        <Button onClick={submit} disabled={saving || departments.length === 0}>
          {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
          {isEdit ? 'حفظ' : 'إنشاء الموظف'}
        </Button>
      </div>
    </div>
  );
}
