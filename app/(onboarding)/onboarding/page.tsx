import { getLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { OnboardingWizard } from '@/components/onboarding/wizard';
import type { SupportedLocale } from '@/i18n/request';

export default async function OnboardingPage() {
  const session = await auth();
  const userName = session?.user?.name ?? '';
  const locale = (await getLocale()) as SupportedLocale;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
      <OnboardingWizard userName={userName} currentLocale={locale} />
    </div>
  );
}
