'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle, Trash2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { saveApiKey, removeApiKey } from '@/lib/actions/settings';

export type ApiSettingsForClient = {
  hasKey: boolean;
  masked: string | null;
  verified: boolean;
  lastTested: string | null;
};

export function ApiSettingsTab({ initial }: { initial: ApiSettingsForClient }) {
  const router = useRouter();
  const t = useTranslations('settings');
  const ta = useTranslations('settings.api');
  const tErr = useTranslations('settings.api.errors');
  const [newKey, setNewKey] = useState('');
  const [isSaving, startSave] = useTransition();
  const [isTesting, startTest] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const onSave = () => {
    if (newKey.trim().length < 10) {
      toast.error(tErr('invalid_format'));
      return;
    }
    startSave(async () => {
      const res = await saveApiKey({ apiKey: newKey.trim() });
      if (res.ok) {
        toast.success(t('saved'));
        setNewKey('');
        router.refresh();
      } else {
        const code = res.error;
        const message =
          code === 'invalid_format' ||
          code === 'unauthorized' ||
          code === 'rate_limited' ||
          code === 'timeout' ||
          code === 'network_error'
            ? tErr(code)
            : code === 'api_error'
              ? tErr('api_error', { status: res.status ?? 0 })
              : t('saveError');
        toast.error(message);
      }
    });
  };

  const onTest = () => {
    startTest(async () => {
      const res = await fetch('/api/byok/test', { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
        status?: number;
      };
      if (json.ok) {
        toast.success(t('saved'));
        router.refresh();
      } else {
        router.refresh(); // also refresh on failure — the route updated lastTested + verified=false
        const code = json.reason ?? 'api_error';
        const message =
          code === 'invalid_format' ||
          code === 'unauthorized' ||
          code === 'rate_limited' ||
          code === 'timeout' ||
          code === 'network_error'
            ? tErr(code)
            : code === 'api_error'
              ? tErr('api_error', { status: json.status ?? 0 })
              : t('saveError');
        toast.error(message);
      }
    });
  };

  const onRemove = () => {
    startDelete(async () => {
      const res = await removeApiKey();
      if (res.ok) {
        toast.success(t('saved'));
        router.refresh();
      } else {
        toast.error(t('saveError'));
      }
    });
  };

  const lastTested = initial.lastTested
    ? new Date(initial.lastTested).toLocaleString()
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{ta('title')}</CardTitle>
        <CardDescription>{ta('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {initial.hasKey ? (
          <div className="rounded-md border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
                <span
                  className="font-mono text-sm truncate"
                  dir="ltr"
                  aria-label={ta('currentKey')}
                >
                  {initial.masked}
                </span>
              </div>
              {initial.verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-500 shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {ta('verified')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-500 shrink-0">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {ta('notVerified')}
                </span>
              )}
            </div>
            {lastTested && (
              <p className="text-xs text-muted-foreground">
                {ta('lastTested', { when: lastTested })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onTest}
                disabled={isTesting || isSaving || isDeleting}
              >
                {isTesting ? ta('testing') : ta('test')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemove}
                disabled={isTesting || isSaving || isDeleting}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="me-1 h-3.5 w-3.5" />
                {ta('removeKey')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {ta('noKey')}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="new-api-key">{ta('newKey')}</Label>
          <Input
            id="new-api-key"
            type="password"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder={ta('newKeyPlaceholder')}
            dir="ltr"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">{ta('newKeyHelp')}</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={onSave}
            disabled={isSaving || newKey.trim().length === 0}
          >
            {isSaving ? t('saving') : ta('saveAndTest')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
