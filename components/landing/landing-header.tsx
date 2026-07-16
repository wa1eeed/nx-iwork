'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Sparkles, LayoutDashboard, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

// Marketing header: sticky glass that gains elevation on scroll + a proper
// mobile menu (the old nav simply hid its links under md).
export function LandingHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useTranslations('landing');
  const tc = useTranslations('common');
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { href: '#capabilities', label: t('nav.features') },
    { href: '#examples', label: t('nav.examples') },
    { href: '#how', label: t('nav.how') },
    { href: '#pricing', label: t('nav.pricing') },
  ];

  return (
    <header
      className={cn(
        'glass sticky top-0 z-40 border-b transition-shadow',
        scrolled && 'shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)]'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
            <Sparkles className="size-4" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{tc('appName')}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LanguageSwitcher />
          {isLoggedIn ? (
            <Button asChild size="sm">
              <Link href="/overview">
                <LayoutDashboard className="size-4" />
                {t('nav.account')}
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t('nav.signin')}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/signup">{t('nav.getStarted')}</Link>
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={t('nav.menu')}
            aria-expanded={open}
            className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground transition hover:text-foreground md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="border-t bg-background/95 backdrop-blur md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            {!isLoggedIn && (
              <div className="mt-2 flex gap-2 border-t pt-3">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/login">{t('nav.signin')}</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/signup">{t('nav.getStarted')}</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
