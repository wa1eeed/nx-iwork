import Link from 'next/link';
import { Bell, Sparkles, Zap } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/dashboard/user-menu';

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  SCALE: 'Scale',
  ENTERPRISE: 'Enterprise',
};

export function Topbar({
  userName,
  userEmail,
  isSuperAdmin,
  tokenBalance = 0,
  plan = 'STARTER',
  pendingApprovals = 0,
}: {
  userName: string;
  userEmail: string;
  isSuperAdmin?: boolean;
  tokenBalance?: number;
  plan?: string;
  pendingApprovals?: number;
}) {
  // Latin digits everywhere (English-primary), compact so the pill never grows.
  const tokens = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.max(0, tokenBalance));
  const planLabel = PLAN_LABEL[plan] ?? plan;
  const needsYou = pendingApprovals > 0;

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

      <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
        {/* Token bank — the energy the workforce spends; tap through to top up. */}
        <Link
          href="/wallet"
          title="بنك التوكنز"
          className="hidden items-center gap-2 rounded-full border bg-card/60 px-3 py-1.5 text-sm transition hover:bg-card md:flex"
        >
          <Zap className="size-3.5 text-amber-500" />
          <span className="font-semibold tabular-nums">{tokens}</span>
          <span className="text-muted-foreground">tokens</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {planLabel}
          </span>
        </Link>

        {/* Automation status — the scheduler runs agents on their triggers.
            The master switch lives in Guardrails (/settings). */}
        <Link
          href="/settings"
          title="الأتمتة — إعدادات الحوكمة"
          className="hidden items-center gap-2 rounded-full border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-card lg:flex"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Automation on
        </Link>

        {/* Needs-you bell — sensitive decisions an agent paused for the owner. */}
        <Link
          href="/approvals"
          title="قرارات تحتاجك"
          className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
            needsYou
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300'
              : 'bg-card/60 text-muted-foreground hover:bg-card'
          }`}
        >
          <Bell className="size-4" />
          {needsYou && (
            <>
              <span className="hidden font-medium sm:inline">{pendingApprovals} need you</span>
              <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white sm:hidden">
                {pendingApprovals}
              </span>
            </>
          )}
        </Link>

        <ThemeToggle />
        <LanguageSwitcher />
        <UserMenu name={userName} email={userEmail} isSuperAdmin={isSuperAdmin} />
      </div>
    </header>
  );
}
