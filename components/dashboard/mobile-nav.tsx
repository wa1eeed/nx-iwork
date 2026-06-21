'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { SidebarBrand, SidebarNav, type NavModules } from '@/components/dashboard/sidebar';

// Phone navigation: a hamburger that opens an animated, RTL-aware drawer reusing
// the desktop sidebar's brand + nav. Hidden on md+ (the static sidebar takes over).
export function MobileNav({ modules }: { modules: NavModules }) {
  const [open, setOpen] = useState(false);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const hiddenX = rtl ? '100%' : '-100%';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            />
            <motion.aside
              className="glass absolute inset-y-0 start-0 flex w-72 max-w-[82%] flex-col border-e shadow-elevated"
              initial={{ x: hiddenX }}
              animate={{ x: 0 }}
              exit={{ x: hiddenX }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            >
              <div className="relative">
                <SidebarBrand />
                <button
                  onClick={() => setOpen(false)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <SidebarNav modules={modules} onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
