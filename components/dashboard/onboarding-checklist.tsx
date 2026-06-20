'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, Circle, X, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface ChecklistItem {
  key: string;
  href: string;
  done: boolean;
}

const DISMISS_KEY = 'nx-onboarding-checklist-dismissed';

export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const t = useTranslations('overview.checklist');
  const [dismissed, setDismissed] = useState(false);

  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = done === total;

  // Persisted dismissal — only meaningful once the user has finished everything,
  // so an incomplete setup keeps nudging.
  if (dismissed || (allDone && typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY))) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Rocket className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">{allDone ? t('done') : t('title')}</p>
              {!allDone && (
                <p className="text-xs text-muted-foreground">{t('subtitle', { done, total })}</p>
              )}
            </div>
          </div>
          {allDone && (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, '1');
                setDismissed(true);
              }}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={t('dismiss')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {!allDone && (
          <>
            <Progress value={(done / total) * 100} />
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      item.done
                        ? 'text-muted-foreground'
                        : 'hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {item.done ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={cn(item.done && 'line-through')}>{t(item.key)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
