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
import { StorefrontTab } from '@/components/settings/storefront-tab';
import { CustomDomainTab } from '@/components/settings/custom-domain-tab';
import { EscalationTab } from '@/components/settings/escalation-tab';
import { EmailTab } from '@/components/settings/email-tab';
import { CompanyInfoTab } from '@/components/settings/company-info-tab';
import { ApiSettingsTab } from '@/components/settings/api-settings-tab';
import { getAiMode } from '@/lib/ai';
import { publicHost } from '@/lib/public-url';
import type { INDUSTRIES } from '@/lib/validators/onboarding';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });
  if (!user?.companyId) redirect('/onboarding');

  const [company, settings, apiSettings, websiteConfig] = await Promise.all([
    db.company.findUnique({
      where: { id: user.companyId },
      select: {
        name: true,
        nameEn: true,
        slug: true,
        logo: true,
        industry: true,
        mainGoal: true,
        vision: true,
        brandVoice: true,
        customDomain: true,
        customDomainVerified: true,
      },
    }),
    db.businessSettings.findUnique({
      where: { companyId: user.companyId },
    }),
    db.companyApiSettings.findUnique({
      where: { companyId: user.companyId },
      select: {
        byokApiKey: true,
        byokProvider: true,
        byokVerified: true,
        byokLastTest: true,
      },
    }),
    db.websiteConfig.findUnique({
      where: { companyId: user.companyId },
      select: {
        heroTitle: true,
        heroTitleEn: true,
        heroSubtitle: true,
        heroSubtitleEn: true,
      },
    }),
  ]);

  const t = await getTranslations('settings');

  if (!company || !settings || !apiSettings) {
    // Onboarding always creates these together — if any are missing, the row
    // was deleted out-of-band. Bounce back through onboarding to recreate.
    redirect('/onboarding');
  }

  const host = publicHost();
  const appIp = process.env.NEXT_PUBLIC_APP_IP || 'YOUR_SERVER_IP';

  // Never send the encrypted ciphertext to the client. Only the masked label
  // and the verified flags travel down.
  const apiSettingsForClient = {
    hasKey: !!apiSettings.byokApiKey,
    masked: apiSettings.byokApiKey
      ? maskApiKey(apiSettings.byokApiKey)
      : null,
    provider: apiSettings.byokProvider,
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
          <TabsTrigger value="storefront">{t('tabs.storefront')}</TabsTrigger>
          <TabsTrigger value="domain">{t('tabs.domain')}</TabsTrigger>
          <TabsTrigger value="escalation">{t('tabs.escalation')}</TabsTrigger>
          <TabsTrigger value="email">{t('tabs.email')}</TabsTrigger>
          <TabsTrigger value="company">{t('tabs.company')}</TabsTrigger>
          {/* Managed mode: the platform supplies the AI centrally — the customer
              never deals with API keys. Only show the tab in BYOK mode. */}
          {getAiMode() === 'byok' && (
            <TabsTrigger value="api">{t('tabs.api')}</TabsTrigger>
          )}
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

        <TabsContent value="storefront">
          <StorefrontTab
            initial={{
              logo: company.logo,
              heroTitle: websiteConfig?.heroTitle ?? null,
              heroTitleEn: websiteConfig?.heroTitleEn ?? null,
              heroSubtitle: websiteConfig?.heroSubtitle ?? null,
              heroSubtitleEn: websiteConfig?.heroSubtitleEn ?? null,
            }}
            publicUrl={`/${company.slug}`}
          />
        </TabsContent>

        <TabsContent value="domain">
          <CustomDomainTab
            initial={{
              customDomain: company.customDomain,
              verified: company.customDomainVerified,
            }}
            host={host}
            appIp={appIp}
          />
        </TabsContent>

        <TabsContent value="escalation">
          <EscalationTab
            initial={{
              telegramBotToken: settings.telegramBotToken,
              telegramChatId: settings.telegramChatId,
            }}
          />
        </TabsContent>

        <TabsContent value="email">
          <EmailTab
            initial={{
              emailSenderName: settings.emailSenderName,
              emailReplyTo: settings.emailReplyTo,
              marketingEmailsEnabled: settings.marketingEmailsEnabled,
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

        {getAiMode() === 'byok' && (
          <TabsContent value="api">
            <ApiSettingsTab initial={apiSettingsForClient} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
