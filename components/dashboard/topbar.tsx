import { Sparkles } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/dashboard/user-menu';

export function Topbar({
  userName,
  userEmail,
  isSuperAdmin,
}: {
  userName: string;
  userEmail: string;
  isSuperAdmin?: boolean;
}) {
  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b px-4 sm:px-6">
      {/* Brand shows on phones where the sidebar is hidden; phone navigation is
          handled by the section carousel + the bottom tab bar. */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
          <Sparkles className="size-4" />
        </span>
        <span className="font-semibold tracking-tight">NX iWork</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
        <UserMenu name={userName} email={userEmail} isSuperAdmin={isSuperAdmin} />
      </div>
    </header>
  );
}
