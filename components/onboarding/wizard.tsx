'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Globe,
  Loader2,
  X,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createCompanyAction } from '@/lib/actions/onboarding';
import { setLocale } from '@/lib/locale';
import { ONBOARDING_PLANS, type OnboardingTier } from '@/lib/plans';
import { INDUSTRIES, SLUG_REGEX, TEAM_SIZES } from '@/lib/validators/onboarding';
import type { SupportedLocale } from '@/i18n/request';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid';

type FormState = {
  name: string;
  nameEn: string;
  slug: string;
  industry: (typeof INDUSTRIES)[number] | '';
  teamSize: (typeof TEAM_SIZES)[number] | '';
  mainGoal: string;
  vision: string;
  plan: OnboardingTier;
  preferredLanguage: SupportedLocale;
};

const TOTAL_STEPS = 4;

// Mirrors lib/companies.ts:slugify — duplicated client-side for live preview.
function slugifyClient(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
}

function publicHostClient(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export function OnboardingWizard({
  userName,
  currentLocale,
}: {
  userName: string;
  currentLocale: SupportedLocale;
}) {
  const t = useTranslations('onboarding');
  const tc = useTranslations('common');
  const host = publicHostClient();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    name: '',
    nameEn: '',
    slug: '',
    industry: '',
    teamSize: '',
    mainGoal: '',
    vision: '',
    plan: 'STARTER',
    preferredLanguage: currentLocale,
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [langPending, startLang] = useTransition();

  const suggestedSlug = useMemo(() => {
    if (slugTouched) return form.slug;
    return slugifyClient(form.nameEn || form.name);
  }, [form.name, form.nameEn, form.slug, slugTouched]);

  const slug = slugTouched ? form.slug : suggestedSlug;

  // Live username availability — debounced fetch against the slug-check API.
  const slugRef = useRef(slug);
  slugRef.current = slug;
  useEffect(() => {
    if (slug.length < 2 || !SLUG_REGEX.test(slug)) {
      setSlugStatus(slug.length === 0 ? 'idle' : 'invalid');
      return;
    }
    setSlugStatus('checking');
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/slug-check?slug=${encodeURIComponent(slug)}`);
        const data: { available: boolean; reason?: string } = await res.json();
        if (slugRef.current !== slug) return; // a newer keystroke superseded us
        setSlugStatus(data.available ? 'available' : (data.reason as SlugStatus) ?? 'taken');
      } catch {
        if (slugRef.current === slug) setSlugStatus('idle');
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [slug]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  const chooseLanguage = (lang: SupportedLocale) => {
    update('preferredLanguage', lang);
    if (lang !== currentLocale) startLang(() => setLocale(lang));
  };

  const canProceed = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return form.name.trim().length > 0 && form.industry !== '' && form.teamSize !== '';
    if (step === 3) return true;
    if (step === 4) return slugStatus === 'available';
    return true;
  }, [step, form, slugStatus]);

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCompanyAction({
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || null,
        slug: slug || null,
        industry: form.industry || null,
        teamSize: form.teamSize || null,
        mainGoal: form.mainGoal.trim() || null,
        vision: form.vision.trim() || null,
        plan: form.plan,
        preferredLanguage: form.preferredLanguage,
      });
      if (!res.ok) {
        const errorKey =
          res.error === 'slug_taken'
            ? 'slugTaken'
            : res.error === 'validation'
              ? 'nameRequired'
              : 'generic';
        setError(t(`errors.${errorKey}`));
      }
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>{t('stepLabel', { current: step, total: TOTAL_STEPS })}</span>
        </div>
        <div>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription className="mt-2">
            {userName ? `${t('subtitle')} — ${userName}` : t('subtitle')}
          </CardDescription>
        </div>
        <Progress value={(step / TOTAL_STEPS) * 100} />
      </CardHeader>

      <CardContent className="space-y-6">
        {step === 1 && (
          <StepLanguage
            selected={form.preferredLanguage}
            onSelect={chooseLanguage}
            pending={langPending}
          />
        )}
        {step === 2 && <StepData form={form} update={update} />}
        {step === 3 && <StepPlan selected={form.plan} onSelect={(p) => update('plan', p)} />}
        {step === 4 && (
          <StepUsername
            slug={slug}
            slugTouched={slugTouched}
            status={slugStatus}
            host={host}
            onSlugChange={(v) => {
              setSlugTouched(true);
              update('slug', slugifyClient(v));
            }}
          />
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || isPending}
          >
            <ChevronRight className="me-1 h-4 w-4 rtl:hidden" />
            <ChevronLeft className="me-1 hidden h-4 w-4 rtl:inline" />
            {tc('back')}
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={!canProceed || isPending}
            >
              {tc('next')}
              <ChevronLeft className="ms-1 h-4 w-4 rtl:hidden" />
              <ChevronRight className="ms-1 hidden h-4 w-4 rtl:inline" />
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={isPending || !canProceed}>
              {isPending ? (
                <>
                  <Loader2 className="me-1 h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                <>
                  <Check className="me-1 h-4 w-4" />
                  {t('createCta')}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StepLanguage({
  selected,
  onSelect,
  pending,
}: {
  selected: SupportedLocale;
  onSelect: (l: SupportedLocale) => void;
  pending: boolean;
}) {
  const t = useTranslations('onboarding');
  const options: { value: SupportedLocale; label: string; sub: string }[] = [
    { value: 'en', label: t('languageEnglish'), sub: 'English' },
    { value: 'ar', label: t('languageArabic'), sub: 'العربية' },
  ];
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-base font-medium">
          <Globe className="h-4 w-4 text-primary" />
          {t('languageStepTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('languageStepSubtitle')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onSelect(o.value)}
              disabled={pending}
              className={cn(
                'flex items-center justify-between rounded-lg border p-4 text-start transition-colors disabled:opacity-60',
                active ? 'border-primary bg-primary/10' : 'border-input hover:bg-accent'
              )}
            >
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground" dir="auto">
                  {o.sub}
                </span>
              </span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepData({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-medium">{t('step1Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('step1Subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company-name">{t('companyName')}</Label>
          <Input
            id="company-name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={t('companyNamePlaceholder')}
            dir="auto"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-name-en">{t('companyNameEn')}</Label>
          <Input
            id="company-name-en"
            value={form.nameEn}
            onChange={(e) => update('nameEn', e.target.value)}
            placeholder={t('companyNameEnPlaceholder')}
            dir="auto"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('industry')}</Label>
        <Select value={form.industry} onValueChange={(v) => update('industry', v as FormState['industry'])}>
          <SelectTrigger>
            <SelectValue placeholder={t('industryPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`industries.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('teamSize')}</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEAM_SIZES.map((key) => {
            const active = form.teamSize === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => update('teamSize', key)}
                className={cn(
                  'rounded-md border px-3 py-2.5 text-sm transition-colors',
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-accent'
                )}
              >
                {t(`teamSizes.${key}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="main-goal">{t('mainGoal')}</Label>
        <Textarea
          id="main-goal"
          value={form.mainGoal}
          onChange={(e) => update('mainGoal', e.target.value)}
          placeholder={t('mainGoalPlaceholder')}
          rows={2}
          dir="auto"
        />
      </div>
    </div>
  );
}

function StepPlan({
  selected,
  onSelect,
}: {
  selected: FormState['plan'];
  onSelect: (p: FormState['plan']) => void;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-medium">{t('planStepTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('planStepSubtitle')}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {ONBOARDING_PLANS.map((plan) => {
          const active = selected === plan.tier;
          return (
            <button
              key={plan.tier}
              type="button"
              onClick={() => onSelect(plan.tier)}
              className={cn(
                'relative flex flex-col rounded-lg border p-4 text-start transition-colors',
                active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input hover:bg-accent'
              )}
            >
              {plan.recommended && (
                <span className="absolute -top-2 inset-x-0 mx-auto w-fit rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {t('plans.recommended')}
                </span>
              )}
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t(`plans.tiers.${plan.tier}.name`)}</span>
                {active && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">{t(`plans.tiers.${plan.tier}.tagline`)}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {plan.priceMonthly === 0 ? (
                  t('plans.free')
                ) : (
                  <>
                    {plan.priceMonthly}
                    <span className="text-sm font-normal text-muted-foreground">
                      {' '}
                      {t('plans.currency')}
                      {t('plans.perMonth')}
                    </span>
                  </>
                )}
              </p>
              <ul className="mt-3 space-y-1.5">
                {plan.featureKeys.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    {t(`plans.features.${f}`)}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepUsername({
  slug,
  slugTouched,
  status,
  host,
  onSlugChange,
}: {
  slug: string;
  slugTouched: boolean;
  status: SlugStatus;
  host: string;
  onSlugChange: (v: string) => void;
}) {
  const t = useTranslations('onboarding');

  const statusUI: Record<SlugStatus, { icon: ReactNode; text: string; cls: string } | null> = {
    idle: null,
    checking: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: t('usernameChecking'),
      cls: 'text-muted-foreground',
    },
    available: {
      icon: <Check className="h-3.5 w-3.5" />,
      text: t('usernameAvailable'),
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    taken: { icon: <X className="h-3.5 w-3.5" />, text: t('usernameTaken'), cls: 'text-destructive' },
    reserved: { icon: <Lock className="h-3.5 w-3.5" />, text: t('usernameReserved'), cls: 'text-destructive' },
    invalid: { icon: <X className="h-3.5 w-3.5" />, text: t('usernameInvalid'), cls: 'text-destructive' },
  };
  const s = statusUI[status];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-medium">{t('usernameStepTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('usernameStepSubtitle')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-slug">{t('companySlug')}</Label>
        <div
          className={cn(
            'flex items-center rounded-md border bg-background ps-3 transition-colors',
            status === 'available' && 'border-emerald-500/60',
            (status === 'taken' || status === 'reserved' || status === 'invalid') && 'border-destructive/60'
          )}
        >
          <span className="select-none text-sm text-muted-foreground" dir="ltr">
            {host}/
          </span>
          <Input
            id="company-slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            dir="ltr"
            className={cn('border-0 font-mono focus-visible:ring-0', !slugTouched && 'text-muted-foreground')}
          />
        </div>
        {s && (
          <p className={cn('flex items-center gap-1.5 text-xs', s.cls)}>
            {s.icon}
            {s.text}
          </p>
        )}
      </div>

      {status === 'available' && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">{t('yourLandingUrl')}</p>
          <p className="mt-1 font-mono text-sm text-primary" dir="ltr">
            {host}/{slug}
          </p>
        </div>
      )}
    </div>
  );
}
