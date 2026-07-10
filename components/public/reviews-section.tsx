'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Star, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <div className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(size, n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </div>
  );
}

export function ReviewsSection({
  slug,
  reviews,
  average,
  count,
  color,
}: {
  slug: string;
  reviews: PublicReview[];
  average: number;
  count: number;
  color?: string;
}) {
  const t = useTranslations('reviewsPublic');
  const accent = color || '#06b6d4';
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  async function submit() {
    if (!name.trim() || rating < 1) return;
    setState('sending');
    setError('');
    try {
      const res = await fetch(`/api/public/${slug}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ authorName: name.trim(), rating, comment: comment.trim() }),
      });
      const data = await res.json();
      if (data.ok) setState('done');
      else {
        setState('idle');
        setError(data.reason === 'rate_limited' ? t('rateLimited') : t('error'));
      }
    } catch {
      setState('idle');
      setError(t('error'));
    }
  }

  return (
    <section id="reviews" className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('sectionTitle')}</h2>
          {count > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <Stars value={average} />
              <span className="text-sm font-semibold tabular-nums">{average.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">· {t('based', { count })}</span>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setOpen(true);
            setState('idle');
          }}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          {t('writeReview')}
        </button>
      </div>

      {reviews.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{r.authorName}</p>
                <Stars value={r.rating} size="size-3.5" />
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Submit modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t('titleModal')}</h3>
              <button onClick={() => setOpen(false)} aria-label={t('close')} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {state === 'done' ? (
              <div className="space-y-3 py-4 text-center">
                <Check className="mx-auto h-12 w-12 text-emerald-500" />
                <p className="text-sm text-muted-foreground">{t('submitted')}</p>
                <button onClick={() => setOpen(false)} className="w-full rounded-lg py-2 text-sm font-medium text-white" style={{ backgroundColor: accent }}>
                  {t('close')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('yourName')}
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                />
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">{t('rating')}</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        aria-label={`${n}`}
                      >
                        <Star
                          className={cn(
                            'size-7 transition',
                            n <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('yourComment')}
                  rows={3}
                  className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  onClick={submit}
                  disabled={state === 'sending' || !name.trim() || rating < 1}
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
    </section>
  );
}
