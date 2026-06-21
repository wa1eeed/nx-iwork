import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Sparkles,
  Bot,
  Zap,
  Brain,
  ShoppingBag,
  MessageSquare,
  Gauge,
  ArrowRight,
  Check,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FadeIn, HoverLift } from '@/components/ui/motion';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { ONBOARDING_PLANS } from '@/lib/plans';

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: 'templates', icon: Bot },
  { key: 'scenarios', icon: Zap },
  { key: 'memory', icon: Brain },
  { key: 'crm', icon: ShoppingBag },
  { key: 'channels', icon: MessageSquare },
  { key: 'control', icon: Gauge },
];

const STEPS = ['s1', 's2', 's3'] as const;

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tp = await getTranslations('onboarding.plans');
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Aurora backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -start-40 -top-40 size-[40rem] rounded-full bg-brand-from/15 blur-[130px] animate-aurora" />
        <div
          className="absolute -end-40 top-1/3 size-[36rem] rounded-full bg-brand-to/15 blur-[130px] animate-aurora"
          style={{ animationDelay: '-9s' }}
        />
      </div>

      {/* Nav */}
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
              <Sparkles className="size-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">NX iWork</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">{t('nav.features')}</a>
            <a href="#how" className="transition-colors hover:text-foreground">{t('nav.how')}</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">{t('nav.pricing')}</a>
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
            {isLoggedIn ? (
              <Button asChild size="sm">
                <Link href="/overview">
                  <LayoutDashboard className="size-4" />
                  {t('nav.account')}
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">{t('nav.signin')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">{t('nav.getStarted')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 pb-20 pt-20 text-center sm:pt-28">
        <FadeIn className="flex flex-col items-center gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-4 py-1.5 text-sm font-medium">
            <span className="size-1.5 animate-glow-pulse rounded-full bg-primary" />
            {t('hero.badge')}
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            <span className="text-gradient">{t('hero.headline')}</span>
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{t('hero.lede')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isLoggedIn ? (
              <Button asChild size="lg">
                <Link href="/overview">
                  <LayoutDashboard className="size-4" />
                  {t('dashboard')}
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/signup">
                    {t('hero.ctaPrimary')}
                    <ArrowRight className="ms-1 size-4 rtl:rotate-180" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">{t('hero.ctaSecondary')}</Link>
                </Button>
              </>
            )}
          </div>
          {!isLoggedIn && <p className="text-xs text-muted-foreground">{t('hero.trust')}</p>}
        </FadeIn>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t('features.title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('features.subtitle')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <HoverLift key={key}>
              <Card className="h-full hover:border-primary/40 hover:shadow-elevated">
                <CardContent className="space-y-3 p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{t(`features.items.${key}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`features.items.${key}.desc`)}</p>
                </CardContent>
              </Card>
            </HoverLift>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t('how.title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('how.subtitle')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s} className="relative overflow-hidden">
              <CardContent className="space-y-2 p-6">
                <span className="text-5xl font-bold text-gradient">{i + 1}</span>
                <h3 className="font-semibold">{t(`how.steps.${s}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`how.steps.${s}.desc`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16 sm:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t('pricing.title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('pricing.subtitle')}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {ONBOARDING_PLANS.map((plan) => (
            <Card
              key={plan.tier}
              className={
                plan.recommended
                  ? 'ring-gradient relative border-primary/30 shadow-elevated lg:-mt-3 lg:mb-3'
                  : 'relative'
              }
            >
              <CardContent className="flex h-full flex-col gap-4 p-6">
                {plan.recommended && (
                  <span className="absolute -top-3 inset-x-0 mx-auto w-fit rounded-full bg-gradient-brand px-3 py-0.5 text-xs font-medium text-white shadow-glow">
                    {tp('recommended')}
                  </span>
                )}
                <div>
                  <p className="font-semibold">{tp(`tiers.${plan.tier}.name`)}</p>
                  <p className="text-xs text-muted-foreground">{tp(`tiers.${plan.tier}.tagline`)}</p>
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {plan.priceMonthly === 0 ? (
                    tp('free')
                  ) : (
                    <>
                      {plan.priceMonthly}
                      <span className="text-sm font-normal text-muted-foreground">
                        {' '}{tp('currency')}{tp('perMonth')}
                      </span>
                    </>
                  )}
                </p>
                <ul className="flex-1 space-y-2">
                  {plan.featureKeys.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {tp(`features.${f}`)}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={plan.recommended ? 'default' : 'outline'} className="w-full">
                  <Link href="/signup">{t('pricing.cta')}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">{t('pricing.note')}</p>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-brand-soft p-10 text-center sm:p-14">
          <div aria-hidden className="pointer-events-none absolute -end-10 -top-10 size-48 rounded-full bg-gradient-brand opacity-20 blur-3xl animate-glow-pulse" />
          <div className="relative flex flex-col items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight">{t('cta.title')}</h2>
            <p className="max-w-md text-muted-foreground">{t('cta.subtitle')}</p>
            <Button asChild size="lg">
              <Link href={isLoggedIn ? '/overview' : '/signup'}>
                {isLoggedIn ? t('dashboard') : t('cta.button')}
                <ArrowRight className="ms-1 size-4 rtl:rotate-180" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-brand text-white">
              <Sparkles className="size-3.5" />
            </span>
            <span className="font-medium text-foreground">NX iWork</span>
            <span className="hidden sm:inline">— {t('footer.tagline')}</span>
          </div>
          <p>© 2026 NX iWork. {t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}
