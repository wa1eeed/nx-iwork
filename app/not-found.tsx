import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Compass, Home } from 'lucide-react';

// Root 404 — shown for any unmatched route. Renders inside the root layout, so
// it inherits the locale + direction.
export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground/70">
          <Compass className="size-6" />
        </div>
        <p className="mt-4 text-3xl font-bold tracking-tight">404</p>
        <h1 className="mt-1 text-lg font-semibold">{t('notFoundTitle')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('notFoundDescription')}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          <Home className="size-4" /> {t('goHome')}
        </Link>
      </div>
    </div>
  );
}
