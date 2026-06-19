'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { createFaq, updateFaq, deleteFaq } from '@/lib/actions/knowledge';

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export function FaqManager({ items }: { items: FaqRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [saving, start] = useTransition();

  function reset() {
    setQuestion('');
    setAnswer('');
    setCategory('');
    setAdding(false);
    setEditingId(null);
  }

  function openEdit(f: FaqRow) {
    setQuestion(f.question);
    setAnswer(f.answer);
    setCategory(f.category ?? '');
    setEditingId(f.id);
    setAdding(false);
  }

  function save() {
    if (!question.trim()) return toast.error('السؤال مطلوب.');
    if (!answer.trim()) return toast.error('الإجابة مطلوبة.');
    const payload = { question: question.trim(), answer: answer.trim(), category: category.trim() || null, isActive: true };
    start(async () => {
      const res = editingId ? await updateFaq(editingId, payload) : await createFaq(payload);
      if (res.ok) {
        toast.success('تم الحفظ.');
        reset();
        router.refresh();
      } else {
        toast.error('تعذّر الحفظ.');
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm('حذف هذا السؤال؟')) return;
    start(async () => {
      const res = await deleteFaq(id);
      if (res.ok) {
        toast.success('تم الحذف.');
        router.refresh();
      } else toast.error('تعذّر الحذف.');
    });
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="space-y-3">
      {!showForm && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="me-1 h-4 w-4" />
          سؤال جديد
        </Button>
      )}

      {showForm && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="space-y-1">
              <Label>السؤال</Label>
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="مثل: كم مدة الشحن للرياض؟" />
            </div>
            <div className="space-y-1">
              <Label>الإجابة</Label>
              <Textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="من 2 إلى 4 أيام عمل." />
            </div>
            <div className="space-y-1">
              <Label>التصنيف (اختياري)</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="الشحن / الاسترجاع / المواعيد" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>إلغاء</Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !showForm && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          لا أسئلة بعد. أضف أسئلة عملائك المتكررة ليجيب عنها الوكلاء بدقة.
        </p>
      )}

      {items.map((f) => (
        <Card key={f.id}>
          <CardContent className="flex items-start gap-3 p-4">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{f.question}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{f.answer}</p>
              {f.category && <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px]">{f.category}</span>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => remove(f.id)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
