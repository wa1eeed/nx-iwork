'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

// Surfaces the cron heartbeat so the owner can SEE that agents run on their own:
// a quiet green pill when healthy, a clear amber warning (with the fix) when the
// every-minute automation loop has stopped firing.
export function AutomationBanner({
  status,
  agoLabel,
}: {
  status: 'healthy' | 'stale' | 'never';
  agoLabel: string | null;
}) {
  const t = useTranslations('pages.agentWork.automation');

  if (status === 'healthy') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        {t('active', { ago: agoLabel ?? '' })}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{t(status === 'never' ? 'neverTitle' : 'staleTitle')}</p>
        <p className="mt-0.5 text-xs opacity-90">{t('fixHint')}</p>
      </div>
    </div>
  );
}
