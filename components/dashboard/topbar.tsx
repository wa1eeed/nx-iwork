import { Sparkles } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/dashboard/user-menu';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import type { NavModules } from '@/components/dashboard/sidebar';

export function Topbar({
  userName,
  userEmail,
  modules,
  isSuperAdmin,
}: {
  userName: string;
  userEmail: string;
  modules: NavModules;
  isSuperAdmin?: boolean;
}) {
  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <MobileNav modules={modules} />
        {/* Brand shows on phones where the sidebar is hidden. */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
            <Sparkles className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">NX iWork</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
        <UserMenu name={userName} email={userEmail} isSuperAdmin={isSuperAdmin} />
      </div>
    </header>
  );
}
