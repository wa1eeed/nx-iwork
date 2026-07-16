'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, MessageCircle } from 'lucide-react';

// Mobile-only sticky booking bar: the storefront's primary CTA ("book") used to
// scroll away with the hero. Appears after the visitor passes the hero, sits
// above the chat FAB, and jumps to #services (+ optional WhatsApp shortcut).
export function StickyBookBar({
  label,
  whatsapp,
  accent,
}: {
  label: string;
  whatsapp?: string | null;
  accent: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 p-3 backdrop-blur sm:hidden">
      <div className="flex items-center gap-2">
        <a
          href="#services"
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-lg transition active:scale-[0.99]"
          style={{ backgroundColor: accent }}
        >
          <CalendarCheck className="size-4" />
          {label}
        </a>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
            aria-label="WhatsApp"
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-card text-emerald-600 dark:text-emerald-400"
          >
            <MessageCircle className="size-5" />
          </a>
        )}
      </div>
    </div>
  );
}
