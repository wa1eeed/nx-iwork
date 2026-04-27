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
  { href: '/overview', icon: LayoutDashboard, labelKey: 'overview' },
  { href: '/agents', icon: Users, labelKey: 'agents' },
  { href: '/departments', icon: Building2, labelKey: 'departments' },
  { href: '/tasks', icon: ListChecks, labelKey: 'tasks' },
  { href: '/chat', icon: MessageSquare, labelKey: 'chat' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
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
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
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
              {tDashboard(labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
