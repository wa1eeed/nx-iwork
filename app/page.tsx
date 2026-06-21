import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Sparkles, Bot, Workflow, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FadeIn } from '@/components/ui/motion';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export default function HomePage() {
  const t = useTranslations('home');

  const features = [
    { icon: Bot, label: t('f1') },
    { icon: Workflow, label: t('f2') },
    { icon: TrendingUp, label: t('f3') },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center">
      {/* Animated aurora backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -start-32 -top-32 size-[34rem] rounded-full bg-brand-from/20 blur-[120px] animate-aurora" />
        <div
          className="absolute -bottom-32 -end-32 size-[34rem] rounded-full bg-brand-to/20 blur-[120px] animate-aurora"
          style={{ animationDelay: '-9s' }}
        />
      </div>

      <div className="absolute end-6 top-6 flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <FadeIn className="flex max-w-2xl flex-col items-center gap-6">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow-lg animate-float">
          <Sparkles className="size-8" />
        </span>

        <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-4 py-1.5 text-sm font-medium">
          <span className="size-1.5 animate-glow-pulse rounded-full bg-primary" />
          {t('badge')}
        </span>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          <span className="text-gradient">{t('subtitle')}</span>
        </h1>

        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">{t('lede')}</p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              {t('signup')}
              <ArrowRight className="ms-1 size-4 rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">{t('login')}</Link>
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {features.map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur"
            >
              <f.icon className="size-4 text-primary" />
              {f.label}
            </span>
          ))}
        </div>
      </FadeIn>
    </main>
  );
}
