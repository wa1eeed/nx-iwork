'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ListChecks, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sub-navigation for the agent-work module: the live task queue + scheduled runs,
// and the deliverables the agents produced. One nav entry with two clearly-named
// tabs — replaces the confusingly-similar "Agent Work" vs "Workspace" nav items.
const TABS = [
  { href: '/agent-work', key: 'work', icon: ListChecks },
  { href: '/outputs', key: 'outputs', icon: Sparkles },
] as const;

export function AgentWorkTabs() {
  const t = useTranslations('biz.agentWorkTabs');
  const pathname = usePathname();
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b">
      {TABS.map(({ href, key, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
