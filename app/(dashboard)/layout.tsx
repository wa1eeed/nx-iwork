import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ShieldAlert } from 'lucide-react';
import { auth } from '@/lib/auth';
import { isAllowlistedSuperAdmin } from '@/lib/admin-allowlist';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { impersonatedCompanyId } from '@/lib/impersonation';
import { stopImpersonation } from '@/lib/actions/admin';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { MobileSectionCarousel } from '@/components/dashboard/mobile-section-carousel';
import { MobileTabBar } from '@/components/dashboard/mobile-tabbar';
import { PageTransition } from '@/components/ui/motion';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const isSuperAdmin =
    session.user.role === 'SUPER_ADMIN' ||
    isAllowlistedSuperAdmin(session.user.email);

  // Read companyId fresh from DB — the JWT can be stale right after onboarding.
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    // The platform owner has no business company — send them to the admin console.
    redirect(isSuperAdmin ? '/admin' : '/onboarding');
  }

  const [company, pendingApprovals] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        slug: true,
        hasEcommerce: true,
        hasServices: true,
        hasBookings: true,
        tokenBalance: true,
        plan: true,
        automationEnabled: true,
      },
    }),
    db.approval.count({ where: { companyId, status: 'PENDING' } }),
  ]);

  // Impersonation banner: the super admin is browsing THIS tenant via the
  // signed cookie (resolved inside getUserCompany) — always show a way out.
  const impersonating = isSuperAdmin && (await impersonatedCompanyId()) === companyId;
  const ti = impersonating ? await getTranslations('impersonation') : null;

  const modules = {
    hasEcommerce: company?.hasEcommerce ?? true,
    hasServices: company?.hasServices ?? true,
    hasBookings: company?.hasBookings ?? false,
  };

  return (
    <div className="theme-command flex min-h-screen bg-background">
      <Sidebar modules={modules} />
      <div className="flex min-w-0 flex-1 flex-col">
        {impersonating && ti && (
          <div className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="inline-flex min-w-0 items-center gap-2">
              <ShieldAlert className="size-4 shrink-0" />
              <span className="truncate">{ti('viewingAs', { name: company?.name ?? '' })}</span>
            </span>
            <form action={stopImpersonation}>
              <button
                type="submit"
                className="shrink-0 rounded-md border border-amber-500/40 px-2.5 py-1 transition hover:bg-amber-500/20"
              >
                {ti('exit')}
              </button>
            </form>
          </div>
        )}
        <Topbar
          userName={session.user.name ?? ''}
          userEmail={session.user.email ?? ''}
          isSuperAdmin={isSuperAdmin}
          tokenBalance={company?.tokenBalance ?? 0}
          plan={company?.plan ?? 'STARTER'}
          pendingApprovals={pendingApprovals}
          automationEnabled={company?.automationEnabled ?? true}
          slug={company?.slug ?? null}
        />
        {/* Phone-only swipeable section strip; desktop uses the sidebar. */}
        <MobileSectionCarousel modules={modules} />
        <main className="flex-1 p-4 pb-24 sm:p-6 md:pb-6">
          <ConfirmProvider>
            <PageTransition>{children}</PageTransition>
          </ConfirmProvider>
        </main>
      </div>
      {/* Phone-only fixed bottom navigation. */}
      <MobileTabBar modules={modules} />
    </div>
  );
}
