'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Building2,
  BookOpen,
  CalendarCheck,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Package,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavModules {
  hasEcommerce: boolean;
  hasBookings: boolean;
}

// `module` marks a nav item as belonging to an optional module — shown only when
// that module is enabled. Items with no `module` are always shown.
const NAV_ITEMS = [
  { href: '/overview', icon: LayoutDashboard, labelKey: 'overview' },
  { href: '/agents', icon: Users, labelKey: 'agents' },
  { href: '/departments', icon: Building2, labelKey: 'departments' },
  { href: '/products', icon: Package, labelKey: 'products', module: 'hasEcommerce' },
  { href: '/bookings', icon: CalendarCheck, labelKey: 'bookings', module: 'hasBookings' },
  { href: '/knowledge', icon: BookOpen, labelKey: 'knowledge' },
  { href: '/tasks', icon: ListChecks, labelKey: 'tasks' },
  { href: '/chat', icon: MessageSquare, labelKey: 'chat' },
  { href: '/modules', icon: LayoutGrid, labelKey: 'modules' },
  { href: '/settings', icon: Settings, labelKey: 'settings' },
] as const;

export function Sidebar({ modules }: { modules: NavModules }) {
  const tDashboard = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  const items = NAV_ITEMS.filter(
    (item) => !('module' in item) || modules[item.module as keyof NavModules]
  );

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e bg-card md:flex">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold tracking-tight">
          {tCommon('appName')}
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {items.map(({ href, icon: Icon, labelKey }) => {
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
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
