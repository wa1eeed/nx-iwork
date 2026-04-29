'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { updateLocalization } from '@/lib/actions/settings';
import type { LocalizationInput } from '@/lib/validators/settings';

const TIMEZONES = [
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Africa/Cairo',
  'Europe/London',
  'America/New_York',
  'UTC',
];

const CURRENCIES = [
  { code: 'SAR', symbol: 'ر.س' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'KWD', symbol: 'د.ك' },
  { code: 'QAR', symbol: 'ر.ق' },
  { code: 'BHD', symbol: 'د.ب' },
  { code: 'EGP', symbol: 'ج.م' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
];

export function LocalizationTab({ initial }: { initial: LocalizationInput }) {
  const t = useTranslations('settings');
  const tl = useTranslations('settings.localization');
  const [form, setForm] = useState<LocalizationInput>(initial);
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof LocalizationInput>(
    key: K,
    value: LocalizationInput[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const onCurrencyChange = (code: string) => {
    const found = CURRENCIES.find((c) => c.code === code);
    setForm((prev) => ({
      ...prev,
      currency: code,
      currencySymbol: found?.symbol ?? prev.currencySymbol,
    }));
  };

  const onSave = () => {
    startTransition(async () => {
      const res = await updateLocalization(form);
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('tabs.localization')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>{tl('primaryLanguage')}</Label>
          <Select
            value={form.primaryLanguage}
            onValueChange={(v) =>
              update('primaryLanguage', v as 'ar' | 'en')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">العربية</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {tl('primaryLanguageHelp')}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{tl('currency')}</Label>
            <Select value={form.currency} onValueChange={onCurrencyChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency-symbol">{tl('currencySymbol')}</Label>
            <Input
              id="currency-symbol"
              value={form.currencySymbol}
              onChange={(e) => update('currencySymbol', e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{tl('dateFormat')}</Label>
            <Select
              value={form.dateFormat}
              onValueChange={(v) =>
                update(
                  'dateFormat',
                  v as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tl('weekStart')}</Label>
            <Select
              value={form.weekStart}
              onValueChange={(v) =>
                update('weekStart', v as 'sunday' | 'monday' | 'saturday')
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">{tl('weekStarts.sunday')}</SelectItem>
                <SelectItem value="monday">{tl('weekStarts.monday')}</SelectItem>
                <SelectItem value="saturday">
                  {tl('weekStarts.saturday')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{tl('timezone')}</Label>
          <Select
            value={form.timezone}
            onValueChange={(v) => update('timezone', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="hijri-toggle" className="text-sm">
              {tl('showHijri')}
            </Label>
          </div>
          <Switch
            id="hijri-toggle"
            checked={form.showHijriDate}
            onCheckedChange={(v) => update('showHijriDate', v)}
          />
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
