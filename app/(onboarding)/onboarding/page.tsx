import { auth } from '@/lib/auth';
import { OnboardingWizard } from '@/components/onboarding/wizard';

export default async function OnboardingPage() {
  const session = await auth();
  const userName = session?.user?.name ?? '';

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center p-6">
      <OnboardingWizard userName={userName} />
    </div>
  );
}
