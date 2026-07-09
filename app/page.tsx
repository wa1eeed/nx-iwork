import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Sparkles,
  Bot,
  Globe,
  Users,
  Contact,
  CircleDollarSign,
  Clock,
  TicketPercent,
  Package2,
  HandCoins,
  CalendarCheck,
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
import { DashboardMockup } from '@/components/landing/dashboard-mockup';
import { WebsiteMockup } from '@/components/landing/website-mockup';
import { ONBOARDING_PLANS } from '@/lib/plans';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bznss.one';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing');
  const tc = await getTranslations('common');
  const title = `${tc('appName')} — ${t('hero.badge')}`;
  const description = t('hero.lede');
  return {
    title,
    description,
    keywords: [
      'booking software', 'appointment scheduling', 'salon software', 'clinic booking',
      'service business platform', 'online booking website', 'CRM', 'invoicing',
      'staff commissions', 'AI assistant', 'Saudi Arabia', 'SaaS',
      'حجز مواعيد', 'نظام حجوزات', 'برنامج صالون', 'حجز عيادة', 'موقع حجوزات',
      'إدارة الأعمال الخدمية', 'مساعد ذكاء اصطناعي', 'منصة سعودية',
    ],
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: '/' },
    openGraph: { title, description, url: SITE_URL, siteName: tc('appName'), type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const STEP_TINTS = ['bg-amber-500/10 text-amber-600 dark:text-amber-400', 'bg-violet-500/10 text-violet-600 dark:text-violet-400', 'bg-sky-500/10 text-sky-600 dark:text-sky-400'];
const STEPS = ['s1', 's2', 's3'] as const;

const MODULES: { key: string; icon: LucideIcon; tint: string }[] = [
  { key: 'bookings', icon: CalendarCheck, tint: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  { key: 'website', icon: Globe, tint: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  { key: 'team', icon: Users, tint: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { key: 'sales', icon: CircleDollarSign, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { key: 'crm', icon: Contact, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  { key: 'ai', icon: Bot, tint: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
];

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: 'waitlist', icon: Clock },
  { key: 'coupons', icon: TicketPercent },
  { key: 'inventory', icon: Package2 },
  { key: 'commissions', icon: HandCoins },
  { key: 'ai', icon: Sparkles },
  { key: 'unified', icon: LayoutDashboard },
];

const STAT_KEYS = ['sectors', 'allInOne', 'langs', 'ai'] as const;
const SECTOR_KEYS = ['clinics', 'salons', 'spa', 'studio', 'fitness', 'tutoring', 'repair', 'consulting'] as const;
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tp = await getTranslations('onboarding.plans');
  const tc = await getTranslations('common');
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);

  // SEO: structured data (SoftwareApplication + FAQ).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: tc('appName'),
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        description: t('hero.lede'),
        url: SITE_URL,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'SAR' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_KEYS.map((k) => ({
          '@type': 'Question',
          name: t(`faq.items.${k}.q`),
          acceptedAnswer: { '@type': 'Answer', text: t(`faq.items.${k}.a`) },
        })),
      },
    ],
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Aurora backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -start-40 -top-40 size-[42rem] rounded-full bg-brand-from/12 blur-[140px] animate-aurora" />
        <div className="absolute -end-40 top-1/4 size-[38rem] rounded-full bg-brand-to/12 blur-[140px] animate-aurora" style={{ animationDelay: '-9s' }} />
      </div>

      {/* Nav */}
      <header className="glass sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
              <Sparkles className="size-4" />
            </span>
            <span className="text-lg font-semibold tracking-tight">{tc('appName')}</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#departments" className="transition-colors hover:text-foreground">{t('nav.features')}</a>
            <a href="#how" className="transition-colors hover:text-foreground">{t('nav.how')}</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">{t('nav.pricing')}</a>
          </nav>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LanguageSwitcher />
            {isLoggedIn ? (
              <Button asChild size="sm">
                <Link href="/overview"><LayoutDashboard className="size-4" />{t('nav.account')}</Link>
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

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
          <FadeIn className="mx-auto flex max-w-3xl flex-col items-center gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-4 py-1.5 text-sm font-medium">
              <span className="size-1.5 animate-glow-pulse rounded-full bg-primary" />
              {t('hero.badge')}
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              {t('hero.headline')} <span className="text-gradient">{t('hero.headlineAccent')}</span>
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{t('hero.lede')}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {isLoggedIn ? (
                <Button asChild size="lg">
                  <Link href="/overview"><LayoutDashboard className="size-4" />{t('dashboard')}</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/signup">{t('hero.ctaPrimary')}<ArrowRight className="ms-1 size-4 rtl:rotate-180" /></Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="#how">{t('hero.ctaSecondary')}</Link>
                  </Button>
                </>
              )}
            </div>
            {!isLoggedIn && <p className="text-xs text-muted-foreground">{t('hero.trust')}</p>}
          </FadeIn>

          <FadeIn delay={0.1} className="mt-14">
            <DashboardMockup />
          </FadeIn>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-card/60 p-6 backdrop-blur sm:grid-cols-4">
            {STAT_KEYS.map((k) => (
              <div key={k} className="text-center">
                <p className="text-2xl font-bold text-gradient sm:text-3xl">{t(`stats.${k}.value`)}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t(`stats.${k}.label`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sectors — the platform fits any service business */}
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="mx-auto mb-6 max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight">{t('sectors.title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t('sectors.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {SECTOR_KEYS.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur"
              >
                <span className="size-1.5 rounded-full bg-gradient-brand" />
                {t(`sectors.items.${k}`)}
              </span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16 sm:px-6">
          <SectionHead title={t('how.title')} subtitle={t('how.subtitle')} />
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Card key={s} className="overflow-hidden">
                <CardContent className="space-y-3 p-6">
                  <span className={`flex size-11 items-center justify-center rounded-xl text-lg font-bold ${STEP_TINTS[i]}`}>{i + 1}</span>
                  <h3 className="font-semibold">{t(`how.steps.${s}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`how.steps.${s}.desc`)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Modules — the six connected areas of the platform */}
        <section id="departments" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-3 py-1 text-xs font-medium">
              {t('modules.badge')}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">{t('modules.title')}</h2>
            <p className="mt-2 text-muted-foreground">{t('modules.subtitle')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ key, icon: Icon, tint }) => (
              <HoverLift key={key}>
                <Card className="h-full hover:border-primary/40 hover:shadow-elevated">
                  <CardContent className="space-y-3 p-6">
                    <span className={`flex size-11 items-center justify-center rounded-xl ${tint}`}>
                      <Icon className="size-5" />
                    </span>
                    <h3 className="font-semibold">{t(`modules.items.${key}.name`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`modules.items.${key}.desc`)}</p>
                  </CardContent>
                </Card>
              </HoverLift>
            ))}
          </div>
        </section>

        {/* Embedded website + widget */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-3 py-1 text-xs font-medium">
                {t('website.badge')}
              </span>
              <h2 className="text-3xl font-bold tracking-tight">{t('website.title')}</h2>
              <p className="text-muted-foreground">{t('website.desc')}</p>
              <ul className="space-y-2">
                {(['p1', 'p2', 'p3'] as const).map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {t(`website.points.${p}`)}
                  </li>
                ))}
              </ul>
            </div>
            <WebsiteMockup />
          </div>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionHead title={t('features.title')} subtitle={t('features.subtitle')} />
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

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16 sm:px-6">
          <SectionHead title={t('pricing.title')} subtitle={t('pricing.subtitle')} />
          <div className="grid gap-4 lg:grid-cols-3">
            {ONBOARDING_PLANS.map((plan) => (
              <Card
                key={plan.tier}
                className={plan.recommended ? 'ring-gradient relative border-primary/30 shadow-elevated lg:-mt-3 lg:mb-3' : 'relative'}
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
                    {plan.priceMonthly === 0 ? tp('free') : (
                      <>{plan.priceMonthly}<span className="text-sm font-normal text-muted-foreground"> {tp('currency')}{tp('perMonth')}</span></>
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

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <SectionHead title={t('faq.title')} subtitle={t('faq.subtitle')} />
          <div className="space-y-3">
            {FAQ_KEYS.map((k) => (
              <details key={k} className="group rounded-xl border bg-card px-5 py-4 shadow-card [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                  {t(`faq.items.${k}.q`)}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{t(`faq.items.${k}.a`)}</p>
              </details>
            ))}
          </div>
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
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-brand text-white">
              <Sparkles className="size-3.5" />
            </span>
            <span className="font-medium text-foreground">{tc('appName')}</span>
            <span className="hidden sm:inline">— {t('footer.tagline')}</span>
          </div>
          <p>© 2026 {tc('appName')}. {t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
