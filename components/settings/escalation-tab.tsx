'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { updateEscalation, testEscalation } from '@/lib/actions/settings';
import type { EscalationInput } from '@/lib/validators/settings';

export function EscalationTab({ initial }: { initial: EscalationInput }) {
  const t = useTranslations('settings');
  const te = useTranslations('settings.escalation');
  const [form, setForm] = useState<EscalationInput>(initial);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const set = <K extends keyof EscalationInput>(k: K, val: EscalationInput[K]) =>
    setForm((p) => ({ ...p, [k]: val }));

  const onSave = () => {
    startSave(async () => {
      const res = await updateEscalation(form);
      if (res.ok) toast.success(t('saved'));
      else toast.error(t('saveError'));
    });
  };

  const onTest = () => {
    startTest(async () => {
      const res = await testEscalation(form);
      if (res.ok) toast.success(te('testSent'));
      else toast.error(te('testFailed'));
    });
  };

  const canTest = Boolean(form.telegramBotToken?.trim() && form.telegramChatId?.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5 text-primary" />
          {te('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">{te('subtitle')}</p>

        <div className="space-y-2">
          <Label>{te('botToken')}</Label>
          <Input
            value={form.telegramBotToken ?? ''}
            onChange={(e) => set('telegramBotToken', e.target.value)}
            placeholder="123456:ABC-DEF..."
            dir="ltr"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{te('botTokenHelp')}</p>
        </div>

        <div className="space-y-2">
          <Label>{te('chatId')}</Label>
          <Input
            value={form.telegramChatId ?? ''}
            onChange={(e) => set('telegramChatId', e.target.value)}
            placeholder="123456789"
            dir="ltr"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{te('chatIdHelp')}</p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">{te('howTitle')}</p>
          <p className="text-xs text-muted-foreground">{te('howBody')}</p>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onTest} disabled={!canTest || testing}>
            <Send className="me-1 h-4 w-4" />
            {te('test')}
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? t('saving') : t('saveCta')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
