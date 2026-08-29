'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Settings, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';

// One "Settings" nav entry, two tabs: the settings themselves and the module
// toggles. Folds the old standalone "Modules" nav item in.
const TABS = [
  { href: '/settings', key: 'settings', icon: Settings },
  { href: '/modules', key: 'modules', icon: LayoutGrid },
] as const;

export function SettingsTabs() {
  const t = useTranslations('biz.settingsTabs');
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
