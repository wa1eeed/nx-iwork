'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { updateCompanyInfo } from '@/lib/actions/settings';
import { INDUSTRIES } from '@/lib/validators/onboarding';
import type { CompanyInfoInput } from '@/lib/validators/settings';

type FormState = {
  name: string;
  nameEn: string;
  industry: (typeof INDUSTRIES)[number] | '';
  mainGoal: string;
  vision: string;
  brandVoice: string;
};

export function CompanyInfoTab({
  initial,
}: {
  initial: {
    name: string;
    nameEn: string | null;
    industry: (typeof INDUSTRIES)[number] | null;
    mainGoal: string | null;
    vision: string | null;
    brandVoice: string | null;
  };
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('settings.company');
  const ti = useTranslations('onboarding.industries');
  const [form, setForm] = useState<FormState>({
    name: initial.name,
    nameEn: initial.nameEn ?? '',
    industry: initial.industry ?? '',
    mainGoal: initial.mainGoal ?? '',
    vision: initial.vision ?? '',
    brandVoice: initial.brandVoice ?? '',
  });
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    const payload: CompanyInfoInput = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim() || null,
      industry: form.industry || null,
      mainGoal: form.mainGoal.trim() || null,
      vision: form.vision.trim() || null,
      brandVoice: form.brandVoice.trim() || null,
    };
    startTransition(async () => {
      const res = await updateCompanyInfo(payload);
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('tabs.company')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">{tc('name')}</Label>
            <Input
              id="company-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-name-en">{tc('nameEn')}</Label>
            <Input
              id="company-name-en"
              value={form.nameEn}
              onChange={(e) => update('nameEn', e.target.value)}
              dir="ltr"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{tc('industry')}</Label>
          <Select
            value={form.industry}
            onValueChange={(v) =>
              update('industry', v as FormState['industry'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((key) => (
                <SelectItem key={key} value={key}>
                  {ti(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="main-goal">{tc('mainGoal')}</Label>
          <Textarea
            id="main-goal"
            value={form.mainGoal}
            onChange={(e) => update('mainGoal', e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vision">{tc('vision')}</Label>
          <Textarea
            id="vision"
            value={form.vision}
            onChange={(e) => update('vision', e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand-voice">{tc('brandVoice')}</Label>
          <Textarea
            id="brand-voice"
            value={form.brandVoice}
            onChange={(e) => update('brandVoice', e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            {tc('brandVoiceHelp')}
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? t('saving') : t('saveCta')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
