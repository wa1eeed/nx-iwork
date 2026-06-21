'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { updatePlatformSettings, type PlatformSettingsInput } from '@/lib/actions/admin';

export function PlatformSettingsForm({ initial }: { initial: PlatformSettingsInput }) {
  const t = useTranslations('admin.settings');
  const [form, setForm] = useState<PlatformSettingsInput>(initial);
  const [pending, start] = useTransition();

  const set = <K extends keyof PlatformSettingsInput>(k: K, v: PlatformSettingsInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const onSave = () =>
    start(async () => {
      const res = await updatePlatformSettings(form);
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-2">
          <Label>{t('siteName')}</Label>
          <Input value={form.siteName} onChange={(e) => set('siteName', e.target.value)} />
        </div>

        <Row label={t('signupEnabled')}>
          <Switch checked={form.signupEnabled} onCheckedChange={(v) => set('signupEnabled', v)} />
        </Row>
        <Row label={t('trialEnabled')}>
          <Switch checked={form.trialEnabled} onCheckedChange={(v) => set('trialEnabled', v)} />
        </Row>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('trialDays')}</Label>
            <Input
              type="number"
              min={0}
              value={form.trialDays}
              onChange={(e) => set('trialDays', Number(e.target.value))}
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('maxCompanies')}</Label>
            <Input
              type="number"
              min={0}
              value={form.maxCompaniesAllowed ?? ''}
              onChange={(e) => set('maxCompaniesAllowed', e.target.value === '' ? null : Number(e.target.value))}
              dir="ltr"
            />
          </div>
        </div>

        <Row label={t('maintenanceMode')}>
          <Switch checked={form.maintenanceMode} onCheckedChange={(v) => set('maintenanceMode', v)} />
        </Row>
        <div className="space-y-2">
          <Label>{t('maintenanceMessage')}</Label>
          <Textarea
            rows={2}
            value={form.maintenanceMessage ?? ''}
            onChange={(e) => set('maintenanceMessage', e.target.value || null)}
            dir="auto"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={onSave} disabled={pending}>{t('save')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <Label className="cursor-default">{label}</Label>
      {children}
    </div>
  );
}
