import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { PageTransition } from '@/components/ui/motion';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

  // Read companyId fresh from DB — the JWT can be stale right after onboarding.
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    // The platform owner has no business company — send them to the admin console.
    redirect(isSuperAdmin ? '/admin' : '/onboarding');
  }

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { hasEcommerce: true, hasBookings: true },
  });

  const modules = {
    hasEcommerce: company?.hasEcommerce ?? true,
    hasBookings: company?.hasBookings ?? false,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar modules={modules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={session.user.name ?? ''}
          userEmail={session.user.email ?? ''}
          modules={modules}
          isSuperAdmin={isSuperAdmin}
        />
        <main className="flex-1 p-4 sm:p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
