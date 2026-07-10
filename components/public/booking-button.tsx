'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, X, Calendar, Clock } from 'lucide-react';

interface Slot {
  startAt: string;
  label: string;
  remaining: number;
  available: boolean;
  waitlist: boolean;
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Public booking CTA for a bookable service. Slots come from the deterministic
// engine (/slots); confirming posts to /book which re-checks capacity atomically.
export function BookingButton({ slug, serviceId, color }: { slug: string; serviceId: string; color?: string }) {
  const t = useTranslations('publicBooking');
  const accent = color || '#06b6d4';
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localToday());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [waitlisted, setWaitlisted] = useState(false);

  const selectedIsWaitlist = slots.find((s) => s.startAt === slot)?.waitlist ?? false;

  async function loadSlots(d: string) {
    setLoadingSlots(true);
    setSlot('');
    setSlots([]);
    try {
      const res = await fetch(`/api/public/${slug}/slots?serviceId=${serviceId}&date=${d}`);
      const data = await res.json();
      setSlots(data.ok ? data.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function start() {
    setOpen(true);
    setState('idle');
    setError('');
    void loadSlots(date);
  }

  function onDate(d: string) {
    setDate(d);
    void loadSlots(d);
  }

  async function submit() {
    if (!name.trim() || !slot) return;
    setState('sending');
    setError('');
    try {
      const res = await fetch(`/api/public/${slug}/book`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          startAt: slot,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim(),
          notes: notes.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setRef(data.ref ?? null);
        setWaitlisted(!!data.waitlist);
        setState('done');
      } else {
        setState('idle');
        setError(
          data.reason === 'slot_full'
            ? t('errSlotFull')
            : data.reason === 'waitlist_full'
              ? t('errWaitlistFull')
              : t('errGeneric')
        );
        void loadSlots(date); // refresh availability
      }
    } catch {
      setState('idle');
      setError(t('errGeneric'));
    }
  }

  return (
    <>
      <button
        onClick={start}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-white transition hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        <Calendar className="h-4 w-4" />
        {t('cta')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">
                {state === 'done'
                  ? waitlisted
                    ? t('titleWaitlist')
                    : t('titleDone')
                  : t('titleBook')}
              </h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {state === 'done' ? (
              <div className="space-y-3 text-center">
                {waitlisted ? (
                  <Clock className="mx-auto h-12 w-12 text-amber-500" />
                ) : (
                  <Check className="mx-auto h-12 w-12 text-emerald-500" />
                )}
                <p className="text-sm text-muted-foreground">
                  {waitlisted ? t('doneWaitlist') : t('doneConfirmed')}
                </p>
                {ref && <p className="font-mono text-xs text-muted-foreground" dir="ltr">{ref}</p>}
                <button onClick={() => setOpen(false)} className="w-full rounded-lg py-2 text-sm font-medium text-white" style={{ backgroundColor: accent }}>
                  {t('close')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{t('date')}</label>
                  <input type="date" value={date} min={localToday()} onChange={(e) => onDate(e.target.value)} dir="ltr" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">{t('availableTime')}</label>
                  {loadingSlots ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : slots.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">{t('noSlots')}</p>
                  ) : (
                    <>
                      <div className="grid max-h-32 grid-cols-3 gap-2 overflow-y-auto">
                        {slots.map((s) => {
                          const sel = slot === s.startAt;
                          return (
                            <button
                              key={s.startAt}
                              onClick={() => setSlot(s.startAt)}
                              dir="ltr"
                              title={s.waitlist ? t('waitlistTag') : undefined}
                              className={`rounded-lg border py-1.5 text-xs transition-colors ${
                                s.waitlist && !sel ? 'border-amber-400/60 text-amber-600' : ''
                              }`}
                              style={
                                sel
                                  ? {
                                      backgroundColor: s.waitlist ? '#f59e0b' : accent,
                                      color: '#fff',
                                      borderColor: s.waitlist ? '#f59e0b' : accent,
                                    }
                                  : undefined
                              }
                            >
                              {s.label}
                              {s.waitlist ? ' •' : ''}
                            </button>
                          );
                        })}
                      </div>
                      {slots.some((s) => s.waitlist) && (
                        <p className="mt-1.5 text-[11px] text-amber-600">{t('waitlistHint')}</p>
                      )}
                    </>
                  )}
                </div>

                {slot && (
                  <>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('name')} className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phone')} dir="ltr" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t('email')} dir="ltr" className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notes')} rows={2} className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" />
                  </>
                )}

                {error && <p className="text-xs text-destructive">{error}</p>}

                <button
                  onClick={submit}
                  disabled={state === 'sending' || !name.trim() || !slot}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {selectedIsWaitlist ? t('joinWaitlist') : t('confirm')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
