'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LayoutDashboard, Building2, Store, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS: { href: string; key: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: '/admin', key: 'overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/companies', key: 'companies', icon: Building2 },
  { href: '/admin/services', key: 'services', icon: Store },
  { href: '/admin/settings', key: 'settings', icon: SlidersHorizontal },
];

export function AdminNav() {
  const t = useTranslations('admin.nav');
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-1 p-4">
      {ITEMS.map(({ href, key, icon: Icon, exact }) => {
        const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-gradient-brand-soft text-primary ring-1 ring-primary/20'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
