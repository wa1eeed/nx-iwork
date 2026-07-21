import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Sparkles,
  ArrowRight,
  Check,
  LayoutDashboard,
  MessageCircle,
  Stethoscope,
  Building2,
  Home,
  ExternalLink,
  TrendingUp,
  Headphones,
  Briefcase,
  Wallet,
  Megaphone,
  type LucideIcon,
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FadeIn, Reveal, RevealGroup, RevealItem } from '@/components/ui/motion';
import { LandingHeader } from '@/components/landing/landing-header';
import { LiveAgentDemo } from '@/components/landing/live-agent-demo';
import { Bento } from '@/components/landing/bento';
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
      'staff commissions', 'AI assistant', 'AI employees', 'Saudi Arabia', 'SaaS',
      'حجز مواعيد', 'نظام حجوزات', 'برنامج صالون', 'حجز عيادة', 'موقع حجوزات',
      'إدارة الأعمال الخدمية', 'مساعد ذكاء اصطناعي', 'موظف ذكاء اصطناعي', 'منصة سعودية',
    ],
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: '/' },
    openGraph: { title, description, url: SITE_URL, siteName: tc('appName'), type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// The AI-employee roster shown as chips under the hero — signals "a whole team
// across departments", so the page doesn't read as just a customer-service bot.
const ROLES: { key: string; icon: LucideIcon }[] = [
  { key: 'sales', icon: TrendingUp },
  { key: 'support', icon: Headphones },
  { key: 'ops', icon: Briefcase },
  { key: 'finance', icon: Wallet },
  { key: 'marketing', icon: Megaphone },
];

const STEP_TINTS = ['bg-amber-500/10 text-amber-600 dark:text-amber-400', 'bg-violet-500/10 text-violet-600 dark:text-violet-400', 'bg-sky-500/10 text-sky-600 dark:text-sky-400'];
const STEPS = ['s1', 's2', 's3'] as const;
const STAT_KEYS = ['sectors', 'allInOne', 'langs', 'ai'] as const;
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;

// The three live demo tenants — real, clickable proof across very different
// sectors (each is a fully seeded business with working agents).
const EXAMPLES: { key: string; slug: string; icon: LucideIcon; tint: string }[] = [
  { key: 'dental', slug: 'basma', icon: Stethoscope, tint: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  { key: 'realestate', slug: 'almaali', icon: Building2, tint: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { key: 'homeservices', slug: 'khedmatak', icon: Home, tint: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
];

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

      <LandingHeader isLoggedIn={isLoggedIn} />

      <main>
        {/* Hero — the pitch on one side, the LIVE product on the other */}
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <FadeIn className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-start">
              <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-4 py-1.5 text-sm font-medium">
                <span className="size-1.5 animate-glow-pulse rounded-full bg-primary" />
                {t('hero.badge')}
              </span>
              <h1 className="text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl xl:text-6xl">
                {t('hero.headline')} <span className="text-gradient">{t('hero.headlineAccent')}</span>
              </h1>
              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">{t('hero.lede')}</p>
              <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
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
                      <Link href="#examples">{t('hero.ctaExamples')}</Link>
                    </Button>
                  </>
                )}
              </div>
              {!isLoggedIn && <p className="text-xs text-muted-foreground">{t('hero.trust')}</p>}
              {/* Department roster — the page is a whole AI workforce, not one bot */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
                <span className="text-xs text-muted-foreground">{t('hero.rolesIntro')}</span>
                {ROLES.map(({ key, icon: Icon }) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full border bg-card/60 px-2.5 py-1 text-xs font-medium backdrop-blur"
                  >
                    <Icon className="size-3 text-primary" />
                    {t(`hero.roles.${key}`)}
                  </span>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                <MessageCircle className="size-3.5 text-primary" />
                {t('hero.channels')}
              </div>
            </FadeIn>

            <FadeIn delay={0.12} className="w-full">
              <p className="mb-2.5 text-center text-xs font-medium text-muted-foreground">
                {t('demo.hint')}
              </p>
              <LiveAgentDemo />
            </FadeIn>
          </div>

          {/* The command-center shot, full-width under the hero */}
          <Reveal className="mt-20" y={26}>
            <DashboardMockup />
          </Reveal>
        </section>

        {/* Stats */}
        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <RevealGroup className="grid grid-cols-2 gap-4 rounded-2xl border bg-card/60 p-6 backdrop-blur sm:grid-cols-4">
            {STAT_KEYS.map((k) => (
              <RevealItem key={k} className="text-center">
                <p className="text-2xl font-bold text-gradient sm:text-3xl">{t(`stats.${k}.value`)}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{t(`stats.${k}.label`)}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* Live examples — real seeded businesses, not screenshots */}
        <section id="examples" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-3 py-1 text-xs font-medium">
                <span className="size-1.5 animate-glow-pulse rounded-full bg-emerald-500" />
                {t('examples.badge')}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">{t('examples.title')}</h2>
              <p className="mt-2 text-muted-foreground">{t('examples.subtitle')}</p>
            </div>
          </Reveal>
          <RevealGroup className="grid gap-4 md:grid-cols-3">
            {EXAMPLES.map(({ key, slug, icon: Icon, tint }) => (
              <RevealItem key={key}>
                <Link
                  href={`/${slug}`}
                  target="_blank"
                  className="group flex h-full flex-col rounded-3xl border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex size-11 items-center justify-center rounded-xl ${tint}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="size-1.5 animate-glow-pulse rounded-full bg-emerald-500" />
                      {t('examples.liveBadge')}
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold">{t(`examples.items.${key}.name`)}</h3>
                  <p className="text-xs text-muted-foreground">{t(`examples.items.${key}.sector`)}</p>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{t(`examples.items.${key}.desc`)}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {t('examples.visit')}
                    <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </span>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* Capabilities bento — the AI-workforce showcase */}
        <section id="capabilities" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-gradient-brand-soft px-3 py-1 text-xs font-medium">
                {t('capabilities.badge')}
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">{t('capabilities.title')}</h2>
              <p className="mt-2 text-muted-foreground">{t('capabilities.subtitle')}</p>
            </div>
          </Reveal>
          <Bento />
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">{t('how.title')}</h2>
              <p className="mt-2 text-muted-foreground">{t('how.subtitle')}</p>
            </div>
          </Reveal>
          <RevealGroup className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <RevealItem key={s}>
                <Card className="h-full overflow-hidden">
                  <CardContent className="space-y-3 p-6">
                    <span className={`flex size-11 items-center justify-center rounded-xl text-lg font-bold ${STEP_TINTS[i]}`}>{i + 1}</span>
                    <h3 className="font-semibold">{t(`how.steps.${s}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`how.steps.${s}.desc`)}</p>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* Embedded website + widget */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal className="space-y-5">
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
            </Reveal>
            <Reveal delay={0.1}>
              <WebsiteMockup />
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">{t('pricing.title')}</h2>
              <p className="mt-2 text-muted-foreground">{t('pricing.subtitle')}</p>
            </div>
          </Reveal>
          <RevealGroup className="grid gap-4 lg:grid-cols-3">
            {ONBOARDING_PLANS.map((plan) => (
              <RevealItem key={plan.tier}>
                <Card
                  className={plan.recommended ? 'ring-gradient relative h-full border-primary/30 shadow-elevated lg:-mt-3 lg:mb-3' : 'relative h-full'}
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
              </RevealItem>
            ))}
          </RevealGroup>
          <p className="mt-4 text-center text-xs text-muted-foreground">{t('pricing.note')}</p>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 sm:px-6">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">{t('faq.title')}</h2>
              <p className="mt-2 text-muted-foreground">{t('faq.subtitle')}</p>
            </div>
          </Reveal>
          <RevealGroup className="space-y-3">
            {FAQ_KEYS.map((k) => (
              <RevealItem key={k}>
                <details className="group rounded-xl border bg-card px-5 py-4 shadow-card [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                    {t(`faq.items.${k}.q`)}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">{t(`faq.items.${k}.a`)}</p>
                </details>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <Reveal>
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
          </Reveal>
        </section>
      </main>

      {/* Footer — real columns instead of a single thin row */}
      <footer className="border-t bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-white">
                <Sparkles className="size-4" />
              </span>
              <span className="font-semibold text-foreground">{tc('appName')}</span>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">{t('footer.tagline')}</p>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5 text-primary" />
              {t('hero.channels')}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">{t('footer.explore')}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#capabilities" className="transition-colors hover:text-foreground">{t('nav.features')}</a></li>
              <li><a href="#examples" className="transition-colors hover:text-foreground">{t('nav.examples')}</a></li>
              <li><a href="#how" className="transition-colors hover:text-foreground">{t('nav.how')}</a></li>
              <li><a href="#pricing" className="transition-colors hover:text-foreground">{t('nav.pricing')}</a></li>
              <li><a href="#faq" className="transition-colors hover:text-foreground">{t('faq.title')}</a></li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">{t('footer.account')}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {isLoggedIn ? (
                <li><Link href="/overview" className="transition-colors hover:text-foreground">{t('dashboard')}</Link></li>
              ) : (
                <>
                  <li><Link href="/signup" className="transition-colors hover:text-foreground">{t('nav.getStarted')}</Link></li>
                  <li><Link href="/login" className="transition-colors hover:text-foreground">{t('nav.signin')}</Link></li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p>© 2026 {tc('appName')}. {t('footer.rights')}</p>
            <p>{t('footer.tagline')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
