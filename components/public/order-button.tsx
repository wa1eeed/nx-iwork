'use client';

import { useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';

// "Order" CTA on the public landing page. Captures name/phone and posts to the
// public order API — which records the order, creates a CRM lead, and wakes the
// responsible agent.
export function OrderButton({
  slug,
  productId,
  serviceId,
  label = 'اطلب الآن',
  color,
}: {
  slug: string;
  productId?: string;
  serviceId?: string;
  label?: string;
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const accent = color || '#06b6d4';

  async function submit() {
    if (!name.trim()) return;
    setState('sending');
    try {
      const res = await fetch(`/api/public/${slug}/order`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, serviceId, customerName: name.trim(), customerPhone: phone.trim(), notes: notes.trim() }),
      });
      const data = await res.json();
      if (data.ok) setState('done');
      else setState('idle');
    } catch {
      setState('idle');
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-white transition hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{state === 'done' ? 'تم استلام طلبك ✅' : 'إتمام الطلب'}</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {state === 'done' ? (
              <div className="space-y-3 text-center">
                <Check className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="text-sm text-muted-foreground">سيتواصل معك فريقنا قريباً.</p>
                <button onClick={() => setOpen(false)} className="w-full rounded-lg py-2 text-sm font-medium text-white" style={{ backgroundColor: accent }}>
                  تمام
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم *" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال" dir="ltr" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)" rows={2} className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                <button
                  onClick={submit}
                  disabled={state === 'sending' || !name.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                  إرسال الطلب
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
