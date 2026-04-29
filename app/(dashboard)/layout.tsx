import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Read companyId fresh from DB — the JWT can be stale right after onboarding.
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    redirect('/onboarding');
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar
          userName={session.user.name ?? ''}
          userEmail={session.user.email ?? ''}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
