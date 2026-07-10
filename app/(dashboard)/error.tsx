'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RotateCcw, LayoutDashboard } from 'lucide-react';

// Route-level error boundary for the dashboard. Catches any render/data throw so
// the user sees a branded, recoverable card instead of a blank screen.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error('Dashboard route error', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('description')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            <RotateCcw className="size-4" /> {t('retry')}
          </button>
          <Link
            href="/overview"
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            <LayoutDashboard className="size-4" /> {t('home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
