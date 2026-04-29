import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const companyId = await getUserCompany(session.user.id);
  if (companyId) {
    redirect('/overview');
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
