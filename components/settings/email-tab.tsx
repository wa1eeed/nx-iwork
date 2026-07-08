'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateEmailSettings } from '@/lib/actions/settings';
import type { EmailInput } from '@/lib/validators/settings';

export function EmailTab({ initial }: { initial: EmailInput }) {
  const t = useTranslations('settings');
  const te = useTranslations('settings.email');
  const [form, setForm] = useState<EmailInput>(initial);
  const [saving, startSave] = useTransition();

  const set = <K extends keyof EmailInput>(k: K, val: EmailInput[K]) =>
    setForm((p) => ({ ...p, [k]: val }));

  const onSave = () => {
    startSave(async () => {
      const res = await updateEmailSettings(form);
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-primary" />
          {te('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">{te('subtitle')}</p>

        <div className="space-y-2">
          <Label>{te('senderName')}</Label>
          <Input
            value={form.emailSenderName ?? ''}
            onChange={(e) => set('emailSenderName', e.target.value)}
            placeholder={te('senderNamePlaceholder')}
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">{te('senderNameHelp')}</p>
        </div>

        <div className="space-y-2">
          <Label>{te('replyTo')}</Label>
          <Input
            value={form.emailReplyTo ?? ''}
            onChange={(e) => set('emailReplyTo', e.target.value)}
            placeholder="hello@yourbrand.com"
            type="email"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">{te('replyToHelp')}</p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-1">
            <Label className="cursor-pointer">{te('marketing')}</Label>
            <p className="text-xs text-muted-foreground">{te('marketingHelp')}</p>
          </div>
          <Switch
            checked={form.marketingEmailsEnabled}
            onCheckedChange={(v) => set('marketingEmailsEnabled', v)}
          />
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">{te('howTitle')}</p>
          <p className="text-xs text-muted-foreground">{te('howBody')}</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving}>
            {saving ? t('saving') : t('saveCta')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
