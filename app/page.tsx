import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="absolute end-6 top-6 flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
      <h1 className="text-5xl font-bold tracking-tight">{t('title')}</h1>
      <p className="max-w-md text-lg text-muted-foreground">{t('subtitle')}</p>
      <p className="text-sm text-muted-foreground">{t('sprintStatus')}</p>
      <div className="mt-4 flex gap-3">
        <Button asChild>
          <Link href="/login">{t('login')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/signup">{t('signup')}</Link>
        </Button>
      </div>
    </main>
  );
}
