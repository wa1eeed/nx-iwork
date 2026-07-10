import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Store, Home } from 'lucide-react';

// Shown when a visitor hits a storefront slug that doesn't exist / is suspended.
export default async function StorefrontNotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground/70">
          <Store className="size-6" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">{t('notFoundTitle')}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('storefrontNotFound')}</p>
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
