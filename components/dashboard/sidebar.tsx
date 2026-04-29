'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/overview', icon: LayoutDashboard, labelKey: 'overview', sprint: null },
  { href: '/agents', icon: Users, labelKey: 'agents', sprint: 2 },
  { href: '/departments', icon: Building2, labelKey: 'departments', sprint: 2 },
  { href: '/tasks', icon: ListChecks, labelKey: 'tasks', sprint: 4 },
  { href: '/chat', icon: MessageSquare, labelKey: 'chat', sprint: 3 },
  { href: '/settings', icon: Settings, labelKey: 'settings', sprint: null },
] as const;

export function Sidebar() {
  const tDashboard = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e bg-card md:flex">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold tracking-tight">
          {tCommon('appName')}
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey, sprint }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{tDashboard(labelKey)}</span>
              {sprint && (
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {tDashboard('sprintBadge', { sprint })}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
