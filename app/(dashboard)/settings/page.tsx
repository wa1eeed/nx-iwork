import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { maskApiKey } from '@/lib/byok';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { LocalizationTab } from '@/components/settings/localization-tab';
import { BrandingTab } from '@/components/settings/branding-tab';
import { CompanyInfoTab } from '@/components/settings/company-info-tab';
import { ApiSettingsTab } from '@/components/settings/api-settings-tab';
import type { INDUSTRIES } from '@/lib/validators/onboarding';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });
  if (!user?.companyId) redirect('/onboarding');

  const [company, settings, apiSettings] = await Promise.all([
    db.company.findUnique({
      where: { id: user.companyId },
      select: {
        name: true,
        nameEn: true,
        industry: true,
        mainGoal: true,
        vision: true,
        brandVoice: true,
      },
    }),
    db.businessSettings.findUnique({
      where: { companyId: user.companyId },
    }),
    db.companyApiSettings.findUnique({
      where: { companyId: user.companyId },
      select: {
        byokApiKey: true,
        byokVerified: true,
        byokLastTest: true,
      },
    }),
  ]);

  const t = await getTranslations('settings');

  if (!company || !settings || !apiSettings) {
    // Onboarding always creates these together — if any are missing, the row
    // was deleted out-of-band. Bounce back through onboarding to recreate.
    redirect('/onboarding');
  }

  // Never send the encrypted ciphertext to the client. Only the masked label
  // and the verified flags travel down.
  const apiSettingsForClient = {
    hasKey: !!apiSettings.byokApiKey,
    masked: apiSettings.byokApiKey
      ? maskApiKey(apiSettings.byokApiKey)
      : null,
    verified: apiSettings.byokVerified,
    lastTested: apiSettings.byokLastTest?.toISOString() ?? null,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="localization">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="localization">{t('tabs.localization')}</TabsTrigger>
          <TabsTrigger value="branding">{t('tabs.branding')}</TabsTrigger>
          <TabsTrigger value="company">{t('tabs.company')}</TabsTrigger>
          <TabsTrigger value="api">{t('tabs.api')}</TabsTrigger>
        </TabsList>

        <TabsContent value="localization">
          <LocalizationTab
            initial={{
              primaryLanguage: settings.primaryLanguage as 'ar' | 'en',
              currency: settings.currency,
              currencySymbol: settings.currencySymbol,
              dateFormat: settings.dateFormat as
                | 'DD/MM/YYYY'
                | 'MM/DD/YYYY'
                | 'YYYY-MM-DD',
              showHijriDate: settings.showHijriDate,
              timezone: settings.timezone,
              weekStart: settings.weekStart as
                | 'sunday'
                | 'monday'
                | 'saturday',
            }}
          />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingTab
            initial={{
              themeMode: settings.themeMode as 'dark' | 'light' | 'system',
              primaryColor: settings.primaryColor,
              accentColor: settings.accentColor,
            }}
          />
        </TabsContent>

        <TabsContent value="company">
          <CompanyInfoTab
            initial={{
              name: company.name,
              nameEn: company.nameEn,
              industry: company.industry as
                | (typeof INDUSTRIES)[number]
                | null,
              mainGoal: company.mainGoal,
              vision: company.vision,
              brandVoice: company.brandVoice,
            }}
          />
        </TabsContent>

        <TabsContent value="api">
          <ApiSettingsTab initial={apiSettingsForClient} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
