'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Bot,
  Building2,
  BookOpen,
  CalendarCheck,
  CheckCircle,
  CircleDollarSign,
  Contact,
  ShoppingBag,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Package,
  Gem,
  Settings,
  Sparkles,
  Store,
  UserCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavModules {
  hasEcommerce: boolean;
  hasServices: boolean;
  hasBookings: boolean;
}

export interface NavItem {
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
// Exported so the mobile tab strip / bottom bar reuse the exact same source.
export const NAV_SECTIONS: NavSection[] = [
  {
    // The Command Center + talking to and tasking the workforce.
    sectionKey: 'command',
    items: [
      { href: '/overview', icon: LayoutDashboard, labelKey: 'overview' },
      { href: '/approvals', icon: CheckCircle, labelKey: 'approvals' },
      { href: '/chat', icon: MessageSquare, labelKey: 'chat' },
      { href: '/tasks', icon: ListChecks, labelKey: 'tasks' },
    ],
  },
  {
    // The AI workforce: employees + the departments they belong to.
    sectionKey: 'workforce',
    items: [
      { href: '/agents', icon: Bot, labelKey: 'agents' },
      { href: '/departments', icon: Building2, labelKey: 'departments' },
    ],
  },
  {
    // The commercial heart: financials + everything that earns revenue.
    sectionKey: 'sales',
    items: [
      { href: '/sales', icon: CircleDollarSign, labelKey: 'financials' },
      { href: '/orders', icon: ShoppingBag, labelKey: 'orders' },
      { href: '/customers', icon: Contact, labelKey: 'customers' },
      { href: '/clients', icon: UserCheck, labelKey: 'clients' },
      { href: '/bookings', icon: CalendarCheck, labelKey: 'bookings', module: 'hasBookings' },
    ],
  },
  {
    // What the business sells + the knowledge its agents draw on.
    sectionKey: 'catalog',
    items: [
      { href: '/products', icon: Package, labelKey: 'products', module: 'hasEcommerce' },
      { href: '/services', icon: Store, labelKey: 'services', module: 'hasServices' },
      { href: '/knowledge', icon: BookOpen, labelKey: 'knowledge' },
    ],
  },
  {
    // The owner's account with the platform.
    sectionKey: 'billing',
    items: [
      { href: '/subscription', icon: Gem, labelKey: 'subscription' },
      { href: '/wallet', icon: Wallet, labelKey: 'wallet' },
    ],
  },
  {
    // Guardrails + platform config.
    sectionKey: 'configure',
    items: [
      { href: '/settings', icon: Settings, labelKey: 'settings' },
      { href: '/modules', icon: LayoutGrid, labelKey: 'modules' },
    ],
  },
];

// Shared nav body — reused by the desktop sidebar and the mobile drawer.
export function SidebarNav({
  modules,
  onNavigate,
}: {
  modules: NavModules;
  onNavigate?: () => void;
}) {
  const tDashboard = useTranslations('dashboard');
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto p-4">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((item) => !item.module || modules[item.module]);
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
                  onClick={onNavigate}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-gradient-brand-soft ring-1 ring-primary/20"
                    />
                  )}
                  {!active && (
                    <span className="absolute inset-0 rounded-lg bg-transparent transition-colors group-hover:bg-accent/50" />
                  )}
                  <Icon className={cn('relative z-10 size-4 shrink-0', active && 'text-primary')} />
                  <span className="relative z-10 flex-1 truncate">{tDashboard(labelKey)}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function SidebarBrand() {
  const tCommon = useTranslations('common');
  return (
    <div className="flex h-16 items-center gap-2.5 border-b px-6">
      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
        <Sparkles className="size-4" />
      </span>
      <span className="text-lg font-semibold tracking-tight">{tCommon('appName')}</span>
    </div>
  );
}

export function Sidebar({ modules }: { modules: NavModules }) {
  return (
    <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e md:flex">
      <SidebarBrand />
      <SidebarNav modules={modules} />
    </aside>
  );
}
