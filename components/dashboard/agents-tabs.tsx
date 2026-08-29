'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bot, Building2, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

// One "Agents" nav entry, three tabs: the roster, the org/departments, and the
// sandbox to test an agent. Folds the old "Departments" and "Studio" nav items in.
const TABS = [
  { href: '/agents', key: 'agents', icon: Bot },
  { href: '/departments', key: 'departments', icon: Building2 },
  { href: '/studio', key: 'studio', icon: FlaskConical },
] as const;

export function AgentsTabs() {
  const t = useTranslations('biz.agentsTabs');
  const pathname = usePathname();
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b">
      {TABS.map(({ href, key, icon: Icon }) => {
        const active =
          href === '/agents'
            ? pathname === '/agents' || pathname.startsWith('/agents/')
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} className={cn('inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition', active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <Icon className="size-4" />
            {t(key)}
          </Link>
        );
      })}
    </div>
  );
}
