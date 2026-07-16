'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

// Storefront mobile menu — the header nav was simply hidden under sm before.
// Minimal client island so the rest of the chrome stays server-rendered.
export function MobileNav({ links, label }: { links: { label: string; href: string }[]; label: string }) {
  const [open, setOpen] = useState(false);
  if (links.length === 0) return null;

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-lg border text-muted-foreground"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full border-b bg-background/95 px-5 py-3 shadow-lg backdrop-blur">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                {l.href.includes('#') ? (
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
