'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { updateBranding } from '@/lib/actions/settings';
import type { BrandingInput } from '@/lib/validators/settings';

export function BrandingTab({ initial }: { initial: BrandingInput }) {
  const t = useTranslations('settings');
  const tb = useTranslations('settings.branding');
  const { setTheme } = useTheme();
  const [form, setForm] = useState<BrandingInput>(initial);
  const [isPending, startTransition] = useTransition();

  const update = <K extends keyof BrandingInput>(
    key: K,
    value: BrandingInput[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    startTransition(async () => {
      const res = await updateBranding(form);
      if (res.ok) {
        // Apply theme change immediately to next-themes so the user sees it
        // without waiting for a full reload.
        setTheme(form.themeMode);
        toast.success(t('saved'));
      } else {
        toast.error(t('saveError'));
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('tabs.branding')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>{tb('themeMode')}</Label>
          <Select
            value={form.themeMode}
            onValueChange={(v) =>
              update('themeMode', v as 'dark' | 'light' | 'system')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">{tb('themeModes.dark')}</SelectItem>
              <SelectItem value="light">{tb('themeModes.light')}</SelectItem>
              <SelectItem value="system">{tb('themeModes.system')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label={tb('primaryColor')}
            value={form.primaryColor}
            onChange={(v) => update('primaryColor', v)}
          />
          <ColorField
            label={tb('accentColor')}
            value={form.accentColor}
            onChange={(v) => update('accentColor', v)}
          />
        </div>

        <p className="text-xs text-muted-foreground">{tb('logoNote')}</p>

        <div className="flex justify-end pt-2">
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? t('saving') : t('saveCta')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-input bg-background"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono"
          dir="ltr"
        />
      </div>
    </div>
  );
}
