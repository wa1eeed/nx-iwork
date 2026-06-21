'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  Contact,
  LayoutDashboard,
  MessageSquare,
  LayoutGrid,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarBrand, SidebarNav, type NavModules } from '@/components/dashboard/sidebar';

// The four always-present primary destinations; the fifth slot is "More".
const PRIMARY = [
  { href: '/overview', icon: LayoutDashboard, labelKey: 'overview' },
  { href: '/chat', icon: MessageSquare, labelKey: 'chat' },
  { href: '/agents', icon: Bot, labelKey: 'agents' },
  { href: '/customers', icon: Contact, labelKey: 'customers' },
];

// Phone-only fixed bottom navigation (native-app feel). Primary sections get a
// tab each; everything else lives behind a "More" bottom sheet that reuses the
// full sidebar nav. Hidden on md+.
export function MobileTabBar({ modules }: { modules: NavModules }) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const primaryActive = PRIMARY.some((p) => isActive(p.href));

  // Lock body scroll + close on Escape while the sheet is open.
  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  return (
    <>
      <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-30 border-t md:hidden">
        <div className="grid grid-cols-5">
          {PRIMARY.map(({ href, icon: Icon, labelKey }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-1 py-2"
              >
                {active && (
                  <motion.span
                    layoutId="mobile-tabbar-active"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-gradient-brand"
                  />
                )}
                <Icon
                  className={cn(
                    'size-5 transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium leading-none transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {t(labelKey)}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen(true)}
            aria-label={t('sections.configure')}
            className="relative flex flex-col items-center justify-center gap-1 py-2"
          >
            {!primaryActive && (
              <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-gradient-brand" />
            )}
            <LayoutGrid
              className={cn(
                'size-5 transition-colors',
                !primaryActive ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            <span
              className={cn(
                'text-[10px] font-medium leading-none transition-colors',
                !primaryActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {tCommon('more')}
            </span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="glass pb-safe absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-2xl border-t shadow-elevated"
            >
              <div className="flex items-center justify-between border-b pe-2">
                <SidebarBrand />
                <button
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close menu"
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="max-h-[calc(80vh-4rem)] overflow-y-auto">
                <SidebarNav modules={modules} onNavigate={() => setMoreOpen(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
