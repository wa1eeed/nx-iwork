'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, type NavModules } from '@/components/dashboard/sidebar';

// Phone-only horizontal "carousel" of every section as a swipeable pill strip,
// sticky just under the topbar. The active pill rides a shared-layout gradient
// and auto-scrolls into the centre on navigation. md+ uses the static sidebar.
export function MobileSectionCarousel({ modules }: { modules: NavModules }) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  const items = NAV_SECTIONS.flatMap((s) => s.items).filter(
    (item) => !item.module || modules[item.module]
  );

  // Keep the active pill visible as the route changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [pathname]);

  return (
    <div className="glass sticky top-16 z-20 border-b md:hidden">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-2.5">
        {items.map(({ href, icon: Icon, labelKey }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              ref={active ? activeRef : undefined}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                active
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-section-active"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-gradient-brand shadow-glow"
                />
              )}
              <Icon className="relative z-10 size-3.5 shrink-0" />
              <span className="relative z-10 whitespace-nowrap">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
