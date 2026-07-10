import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/admin';
import { AdminNav } from '@/components/admin/admin-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { UserMenu } from '@/components/dashboard/user-menu';
import { PageTransition } from '@/components/ui/motion';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // SUPER_ADMIN only — everyone else is bounced to their dashboard.
  const admin = await requireSuperAdmin();
  if (!admin.ok) redirect('/overview');

  const session = await auth();
  const t = await getTranslations('admin');

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="glass sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-6">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
            <Sparkles className="size-4" />
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-semibold">{t('title')}</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="size-3" />
              Super admin
            </span>
          </div>
        </div>
        <AdminNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-end gap-1 border-b px-4 sm:px-6">
          <ThemeToggle />
          <LanguageSwitcher />
          <UserMenu name={session?.user?.name ?? ''} email={session?.user?.email ?? ''} />
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <ConfirmProvider>
            <PageTransition>{children}</PageTransition>
          </ConfirmProvider>
        </main>
      </div>
    </div>
  );
}
