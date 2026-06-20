'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/dashboard/image-upload';
import { updateStorefront } from '@/lib/actions/settings';
import type { StorefrontInput } from '@/lib/validators/settings';

export function StorefrontTab({
  initial,
  publicUrl,
}: {
  initial: StorefrontInput;
  publicUrl: string;
}) {
  const t = useTranslations('settings');
  const ts = useTranslations('settings.storefront');
  const [form, setForm] = useState<StorefrontInput>(initial);
  const [isPending, start] = useTransition();

  const update = <K extends keyof StorefrontInput>(key: K, value: StorefrontInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    start(async () => {
      const res = await updateStorefront(form);
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{ts('title')}</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link href={publicUrl} target="_blank">
            <ExternalLink className="me-1 h-4 w-4" />
            {ts('viewSite')}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">{ts('subtitle')}</p>

        <div className="space-y-2">
          <Label>{ts('logo')}</Label>
          <ImageUpload
            value={form.logo ? [form.logo] : []}
            onChange={(urls) => update('logo', urls[0] ?? '')}
            max={1}
            purpose="logo"
          />
          <p className="text-xs text-muted-foreground">{ts('logoHelp')}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="hero-title">{ts('heroTitle')}</Label>
            <Input
              id="hero-title"
              value={form.heroTitle ?? ''}
              onChange={(e) => update('heroTitle', e.target.value)}
              placeholder={ts('heroTitlePlaceholder', { company: '' })}
              dir="auto"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-title-en">{ts('heroTitleAlt')}</Label>
            <Input
              id="hero-title-en"
              value={form.heroTitleEn ?? ''}
              onChange={(e) => update('heroTitleEn', e.target.value)}
              dir="auto"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="hero-sub">{ts('heroSubtitle')}</Label>
            <Textarea
              id="hero-sub"
              value={form.heroSubtitle ?? ''}
              onChange={(e) => update('heroSubtitle', e.target.value)}
              placeholder={ts('heroSubtitlePlaceholder')}
              rows={2}
              dir="auto"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-sub-en">{ts('heroSubtitleAlt')}</Label>
            <Textarea
              id="hero-sub-en"
              value={form.heroSubtitleEn ?? ''}
              onChange={(e) => update('heroSubtitleEn', e.target.value)}
              rows={2}
              dir="auto"
            />
          </div>
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
