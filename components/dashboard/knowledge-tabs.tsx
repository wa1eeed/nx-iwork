'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookOpen, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

// One nav entry, two tabs: the business answers + triggers, and the custom data
// models agents read. Replaces the separate "Knowledge" and "Data" nav items.
const TABS = [
  { href: '/knowledge', key: 'knowledge', icon: BookOpen },
  { href: '/data', key: 'data', icon: Database },
] as const;

export function KnowledgeTabs() {
  const t = useTranslations('biz.knowledgeTabs');
  const pathname = usePathname();
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b">
      {TABS.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
