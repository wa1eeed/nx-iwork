import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { PlatformSettingsForm } from '@/components/admin/platform-settings-form';
import type { PlatformSettingsInput } from '@/lib/actions/admin';

export default async function AdminSettingsPage() {
  const t = await getTranslations('admin.settings');
  const s = await db.platformSettings.findUnique({ where: { id: 'singleton' } });

  const initial: PlatformSettingsInput = {
    siteName: s?.siteName ?? 'NX iWork',
    signupEnabled: s?.signupEnabled ?? true,
    trialEnabled: s?.trialEnabled ?? true,
    trialDays: s?.trialDays ?? 14,
    maintenanceMode: s?.maintenanceMode ?? false,
    maintenanceMessage: s?.maintenanceMessage ?? null,
    maxCompaniesAllowed: s?.maxCompaniesAllowed ?? null,
    tokenPricePerMillion: s?.tokenPricePerMillion ? s.tokenPricePerMillion.toNumber() : 5,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <PlatformSettingsForm initial={initial} />
    </div>
  );
}
