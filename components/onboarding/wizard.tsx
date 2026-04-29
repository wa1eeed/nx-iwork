'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
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
import {
  INDUSTRIES,
  SLUG_REGEX,
  TEAM_SIZES,
} from '@/lib/validators/onboarding';

type FormState = {
  name: string;
  nameEn: string;
  slug: string;
  industry: (typeof INDUSTRIES)[number] | '';
  teamSize: (typeof TEAM_SIZES)[number] | '';
  mainGoal: string;
  vision: string;
};

const INITIAL: FormState = {
  name: '',
  nameEn: '',
  slug: '',
  industry: '',
  teamSize: '',
  mainGoal: '',
  vision: '',
};

const TOTAL_STEPS = 4;

// Mirrors lib/companies.ts:slugify — duplicated client-side for live preview so
// users see the slug update as they type.
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

export function OnboardingWizard({ userName }: { userName: string }) {
  const t = useTranslations('onboarding');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Live slug suggestion: prefer English name, fall back to Arabic.
  const suggestedSlug = useMemo(() => {
    if (slugTouched) return form.slug;
    const base = form.nameEn || form.name;
    return slugifyClient(base);
  }, [form.name, form.nameEn, form.slug, slugTouched]);

  const slugForDisplay = slugTouched ? form.slug : suggestedSlug;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  const canProceed = useMemo(() => {
    if (step === 1) {
      if (form.name.trim().length === 0) return false;
      const slug = slugForDisplay;
      if (slug.length < 2 || !SLUG_REGEX.test(slug)) return false;
      return true;
    }
    if (step === 2) return form.industry !== '' && form.teamSize !== '';
    if (step === 3) return true; // both optional
    return true;
  }, [step, form, slugForDisplay]);

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCompanyAction({
        name: form.name.trim(),
        nameEn: form.nameEn.trim() || null,
        slug: slugForDisplay || null,
        industry: form.industry || null,
        teamSize: form.teamSize || null,
        mainGoal: form.mainGoal.trim() || null,
        vision: form.vision.trim() || null,
      });
      // On success the action redirects; we only land here on error.
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

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>
            {t('stepLabel', { current: step, total: TOTAL_STEPS })}
          </span>
        </div>
        <div>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          <CardDescription className="mt-2">
            {userName ? `${t('subtitle')} — ${userName}` : t('subtitle')}
          </CardDescription>
        </div>
        <Progress value={progress} />
      </CardHeader>

      <CardContent className="space-y-6">
        {step === 1 && (
          <Step1
            form={form}
            slugForDisplay={slugForDisplay}
            slugTouched={slugTouched}
            onSlugChange={(v) => {
              setSlugTouched(true);
              update('slug', slugifyClient(v));
            }}
            update={update}
          />
        )}
        {step === 2 && <Step2 form={form} update={update} />}
        {step === 3 && <Step3 form={form} update={update} />}
        {step === 4 && (
          <Step4 form={form} slugForDisplay={slugForDisplay} />
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
            <ChevronLeft className="me-1 h-4 w-4 hidden rtl:inline" />
            <BackLabel />
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              disabled={!canProceed || isPending}
            >
              <NextLabel />
              <ChevronLeft className="ms-1 h-4 w-4 rtl:hidden" />
              <ChevronRight className="ms-1 h-4 w-4 hidden rtl:inline" />
            </Button>
          ) : (
            <Button type="button" onClick={onSubmit} disabled={isPending}>
              {isPending ? (
                t('creating')
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

function BackLabel() {
  const t = useTranslations('common');
  return <span>{t('back')}</span>;
}

function NextLabel() {
  const t = useTranslations('common');
  return <span>{t('next')}</span>;
}

function Step1({
  form,
  slugForDisplay,
  slugTouched,
  onSlugChange,
  update,
}: {
  form: FormState;
  slugForDisplay: string;
  slugTouched: boolean;
  onSlugChange: (v: string) => void;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const t = useTranslations('onboarding');
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-medium">{t('step1Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('step1Subtitle')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-name">{t('companyName')}</Label>
        <Input
          id="company-name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder={t('companyNamePlaceholder')}
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
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-slug">{t('companySlug')}</Label>
        <div className="flex items-center gap-2">
          <span
            className="select-none text-sm text-muted-foreground"
            dir="ltr"
          >
            nx.sa/
          </span>
          <Input
            id="company-slug"
            value={slugForDisplay}
            onChange={(e) => onSlugChange(e.target.value)}
            dir="ltr"
            className={cn(
              'font-mono',
              !slugTouched && 'text-muted-foreground'
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t('companySlugHelp', { slug: slugForDisplay || 'company' })}
        </p>
      </div>
    </div>
  );
}

function Step2({
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
        <h3 className="text-base font-medium">{t('step2Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('step2Subtitle')}</p>
      </div>

      <div className="space-y-2">
        <Label>{t('industry')}</Label>
        <Select
          value={form.industry}
          onValueChange={(v) =>
            update('industry', v as FormState['industry'])
          }
        >
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
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input hover:bg-accent'
                )}
              >
                {t(`teamSizes.${key}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Step3({
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
        <h3 className="text-base font-medium">{t('step3Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('step3Subtitle')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="main-goal">{t('mainGoal')}</Label>
        <Textarea
          id="main-goal"
          value={form.mainGoal}
          onChange={(e) => update('mainGoal', e.target.value)}
          placeholder={t('mainGoalPlaceholder')}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vision">{t('vision')}</Label>
        <Textarea
          id="vision"
          value={form.vision}
          onChange={(e) => update('vision', e.target.value)}
          placeholder={t('visionPlaceholder')}
          rows={4}
        />
      </div>
    </div>
  );
}

function Step4({
  form,
  slugForDisplay,
}: {
  form: FormState;
  slugForDisplay: string;
}) {
  const t = useTranslations('onboarding');

  const rows: Array<{ label: string; value: string | null }> = [
    { label: t('reviewName'), value: form.name },
    { label: t('reviewNameEn'), value: form.nameEn || null },
    { label: t('reviewSlug'), value: slugForDisplay || null },
    {
      label: t('reviewIndustry'),
      value: form.industry ? t(`industries.${form.industry}`) : null,
    },
    {
      label: t('reviewTeamSize'),
      value: form.teamSize ? t(`teamSizes.${form.teamSize}`) : null,
    },
    { label: t('reviewMainGoal'), value: form.mainGoal || null },
    { label: t('reviewVision'), value: form.vision || null },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-medium">{t('step4Title')}</h3>
        <p className="text-sm text-muted-foreground">{t('step4Subtitle')}</p>
      </div>

      <dl className="divide-y divide-border rounded-md border">
        {rows
          .filter((r) => r.value)
          .map((r) => (
            <div
              key={r.label}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <dt className="min-w-[6rem] text-sm font-medium text-muted-foreground">
                {r.label}
              </dt>
              <dd className="flex-1 text-sm text-end break-words">
                {r.value}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
