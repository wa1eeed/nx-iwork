'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GitBranch, Users, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sub-navigation for the CRM module — the pipeline, the customer directory, and
// tasks all live under one roof so the owner follows opportunities in one place.
const TABS = [
  { href: '/crm', key: 'pipeline', icon: GitBranch },
  { href: '/clients', key: 'customers', icon: Users },
  { href: '/tasks', key: 'tasks', icon: ListChecks },
] as const;

export function CrmTabs() {
  const t = useTranslations('biz.crmTabs');
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b">
      {TABS.map(({ href, key, icon: Icon }) => {
        const active =
          href === '/crm'
            ? pathname === '/crm' || pathname.startsWith('/customers')
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-4" />
            {t(key)}
          </Link>
        );
      })}
    </div>
  );
}
