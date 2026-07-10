'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, X } from 'lucide-react';

// "Order" CTA on the public landing page. Captures name/phone and posts to the
// public order API — which records the order, creates a CRM lead, and wakes the
// responsible agent.
export function OrderButton({
  slug,
  productId,
  serviceId,
  label,
  color,
}: {
  slug: string;
  productId?: string;
  serviceId?: string;
  label?: string;
  color?: string;
}) {
  const t = useTranslations('publicOrder');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [coupon, setCoupon] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const accent = color || '#06b6d4';

  async function submit() {
    if (!name.trim()) return;
    setState('sending');
    setError('');
    try {
      const res = await fetch(`/api/public/${slug}/order`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productId,
          serviceId,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
          notes: notes.trim(),
          couponCode: coupon.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) setState('done');
      else {
        setState('idle');
        setError(data.reason === 'coupon_invalid' ? t('errCoupon') : t('errGeneric'));
      }
    } catch {
      setState('idle');
      setError(t('errGeneric'));
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-white transition hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        {label ?? (serviceId ? t('ctaService') : t('cta'))}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{state === 'done' ? t('titleDone') : t('titleCheckout')}</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {state === 'done' ? (
              <div className="space-y-3 text-center">
                <Check className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="text-sm text-muted-foreground">{t('doneMsg')}</p>
                <button onClick={() => setOpen(false)} className="w-full rounded-lg py-2 text-sm font-medium text-white" style={{ backgroundColor: accent }}>
                  {t('close')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('name')} className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phone')} dir="ltr" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('email')} dir="ltr" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notes')} rows={2} className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                <input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder={t('coupon')} dir="ltr" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm uppercase outline-none" />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  onClick={submit}
                  disabled={state === 'sending' || !name.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('submit')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
