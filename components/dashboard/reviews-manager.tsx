'use client';

import { useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Star, Eye, EyeOff, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { setReviewStatus, deleteReview } from '@/lib/actions/reviews';
import type { ReviewStatus } from '@prisma/client';

export interface ReviewRow {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  serviceTitle: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<ReviewStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  HIDDEN: 'bg-muted text-muted-foreground',
};

function Stars({ value }: { value: number }) {
  return (
    <div className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

export function ReviewsManager({ reviews }: { reviews: ReviewRow[] }) {
  const t = useTranslations('reviewsMgr');
  const tc = useTranslations('common');
  const locale = useLocale();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<'all' | ReviewStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const shown = reviews.filter((r) => filter === 'all' || r.status === filter);

  function moderate(id: string, status: ReviewStatus) {
    setBusyId(id);
    start(async () => {
      await setReviewStatus({ id, status });
      setBusyId(null);
    });
  }

  async function remove(r: ReviewRow) {
    if (!(await confirm({ title: t('confirmDelete'), destructive: true, confirmLabel: tc('delete'), cancelLabel: tc('cancel') }))) return;
    setBusyId(r.id);
    start(async () => {
      await deleteReview(r.id);
      setBusyId(null);
    });
  }

  const FILTERS: Array<'all' | ReviewStatus> = ['all', 'PENDING', 'PUBLISHED', 'HIDDEN'];
  const filterKey: Record<string, string> = {
    all: 'filterAll',
    PENDING: 'filterPending',
    PUBLISHED: 'filterPublished',
    HIDDEN: 'filterHidden',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              filter === f ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-accent',
            )}
          >
            {t(filterKey[f])}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  <p className="font-medium">{r.authorName}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[r.status])}>
                    {t(`status${r.status}`)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{dateFmt.format(new Date(r.createdAt))}</span>
                </div>
                {r.serviceTitle && <p className="mt-1 text-xs text-muted-foreground">{t('forService', { service: r.serviceTitle })}</p>}
                {r.comment && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.status !== 'PUBLISHED' && (
                    <button
                      disabled={busy}
                      onClick={() => moderate(r.id, 'PUBLISHED')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="size-3.5" /> {t('publish')}
                    </button>
                  )}
                  {r.status === 'PUBLISHED' && (
                    <button
                      disabled={busy}
                      onClick={() => moderate(r.id, 'HIDDEN')}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
                    >
                      <EyeOff className="size-3.5" /> {t('unpublish')}
                    </button>
                  )}
                  {r.status === 'PENDING' && (
                    <button
                      disabled={busy}
                      onClick={() => moderate(r.id, 'HIDDEN')}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
                    >
                      <EyeOff className="size-3.5" /> {t('hide')}
                    </button>
                  )}
                  {r.status === 'HIDDEN' && (
                    <button
                      disabled={busy}
                      onClick={() => moderate(r.id, 'PUBLISHED')}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-accent disabled:opacity-50"
                    >
                      <Eye className="size-3.5" /> {t('publish')}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => remove(r)}
                    aria-label={t('delete')}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" /> {t('delete')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
