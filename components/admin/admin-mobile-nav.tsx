'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ADMIN_NAV_ITEMS } from '@/components/admin/admin-nav';

// Phone-only horizontal pill strip for the super-admin console. The desktop
// sidebar is `hidden md:flex`, so WITHOUT this there is no way to move between
// the admin sections on a phone. Mirrors the tenant dashboard's
// MobileSectionCarousel: sticky under the header, swipeable, active pill rides a
// shared-layout gradient and auto-scrolls into the centre on navigation.
export function AdminMobileNav() {
  const t = useTranslations('admin.nav');
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <div className="glass sticky top-16 z-20 border-b md:hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-2.5">
        {ADMIN_NAV_ITEMS.map(({ href, key, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              ref={active ? activeRef : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                active ? 'text-white' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-mobile-active"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-gradient-brand shadow-glow"
                />
              )}
              <Icon className="relative z-10 size-3.5 shrink-0" />
              <span className="relative z-10 whitespace-nowrap">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
