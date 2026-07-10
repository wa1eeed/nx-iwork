'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// A themed, promise-based confirmation dialog — a drop-in replacement for the
// native, unstyled window.confirm() (which ignores dark mode + RTL). Mount
// <ConfirmProvider> once at the dashboard root, then in any client component:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: t('deleteTitle'), destructive: true }))) return;
//
// Labels are passed in (already localized) so the primitive stays i18n-agnostic.

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Confirm = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => settle(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl',
                  opts.destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground/70',
                )}
              >
                <AlertTriangle className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{opts.title}</h3>
                {opts.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{opts.description}</p>
                )}
              </div>
              <button
                onClick={() => settle(false)}
                aria-label={opts.cancelLabel ?? 'Cancel'}
                className="text-muted-foreground transition hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => settle(false)}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
              >
                {opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => settle(true)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90',
                  opts.destructive ? 'bg-destructive' : 'bg-foreground text-background',
                )}
              >
                {opts.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
