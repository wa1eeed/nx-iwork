'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bot,
  Building2,
  BookOpen,
  CalendarCheck,
  Contact,
  ShoppingBag,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Package,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavModules {
  hasEcommerce: boolean;
  hasBookings: boolean;
}

interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  module?: keyof NavModules;
}

interface NavSection {
  sectionKey: string;
  items: NavItem[];
}

// Grouped navigation. Items carrying a `module` key appear only when that
// optional module is enabled for the company; everything else is always shown.
const NAV_SECTIONS: NavSection[] = [
  {
    sectionKey: 'workspace',
    items: [
      { href: '/overview', icon: LayoutDashboard, labelKey: 'overview' },
      { href: '/chat', icon: MessageSquare, labelKey: 'chat' },
    ],
  },
  {
    sectionKey: 'team',
    items: [
      { href: '/agents', icon: Bot, labelKey: 'agents' },
      { href: '/departments', icon: Building2, labelKey: 'departments' },
    ],
  },
  {
    sectionKey: 'sales',
    items: [
      { href: '/customers', icon: Contact, labelKey: 'customers' },
      { href: '/products', icon: Package, labelKey: 'products', module: 'hasEcommerce' },
      { href: '/orders', icon: ShoppingBag, labelKey: 'orders' },
      { href: '/bookings', icon: CalendarCheck, labelKey: 'bookings', module: 'hasBookings' },
    ],
  },
  {
    sectionKey: 'knowledge',
    items: [
      { href: '/knowledge', icon: BookOpen, labelKey: 'knowledge' },
      { href: '/tasks', icon: ListChecks, labelKey: 'tasks' },
    ],
  },
  {
    sectionKey: 'configure',
    items: [
      { href: '/modules', icon: LayoutGrid, labelKey: 'modules' },
      { href: '/settings', icon: Settings, labelKey: 'settings' },
    ],
  },
];

export function Sidebar({ modules }: { modules: NavModules }) {
  const tDashboard = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e bg-card md:flex">
      <div className="flex h-16 items-center gap-2.5 border-b px-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </span>
        <span className="text-lg font-semibold tracking-tight">{tCommon('appName')}</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(
            (item) => !item.module || modules[item.module]
          );
          if (items.length === 0) return null;
          return (
            <div key={section.sectionKey} className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {tDashboard(`sections.${section.sectionKey}`)}
              </p>
              {items.map(({ href, icon: Icon, labelKey }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active && 'text-primary')} />
                    <span className="flex-1 truncate">{tDashboard(labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
