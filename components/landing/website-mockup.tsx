import { useTranslations } from 'next-intl';
import { Lock, Sparkles, Send } from 'lucide-react';

// A code-built mock of a customer's public website (on their own domain) with the
// embedded AI chat widget mid-conversation — illustrates the built-in storefront.
export function WebsiteMockup() {
  const t = useTranslations('landing.mock');
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div aria-hidden className="absolute inset-6 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-3xl" />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elevated ring-1 ring-foreground/5">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-amber-400/80" />
          <span className="size-3 rounded-full bg-emerald-400/80" />
          <div className="ms-2 flex flex-1 items-center justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1 text-[11px] text-muted-foreground" dir="ltr">
              <Lock className="size-3" />
              acme.yourbrand.com
            </span>
          </div>
        </div>

        {/* Faux storefront */}
        <div className="relative bg-gradient-to-b from-muted/40 to-transparent p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-brand text-white">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-sm font-semibold">{t('widgetTitle')}</span>
          </div>
          <div className="mb-4 space-y-2">
            <div className="h-3 w-2/3 rounded bg-foreground/10" />
            <div className="h-3 w-1/2 rounded bg-foreground/10" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border p-2">
                <div className="mb-2 aspect-square rounded-md bg-gradient-brand-soft" />
                <div className="h-2 w-3/4 rounded bg-foreground/10" />
                <div className="mt-1 h-2 w-1/2 rounded bg-primary/40" />
              </div>
            ))}
          </div>

          {/* Embedded chat widget */}
          <div className="mt-4 ms-auto w-full max-w-[17rem] overflow-hidden rounded-xl border bg-card shadow-elevated">
            <div className="flex items-center gap-2 bg-gradient-brand px-3 py-2 text-white">
              <span className="flex size-6 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="size-3" />
              </span>
              <span className="text-xs font-medium">{t('widgetTitle')}</span>
              <span className="ms-auto inline-flex items-center gap-1 text-[10px]">
                <span className="size-1.5 rounded-full bg-emerald-300" />
                {t('online')}
              </span>
            </div>
            <div className="space-y-2 p-3">
              <Bubble agent>{t('widgetGreeting')}</Bubble>
              <Bubble>{t('widgetUser')}</Bubble>
              <Bubble agent>{t('widgetAgent')}</Bubble>
            </div>
            <div className="flex items-center gap-2 border-t px-3 py-2">
              <span className="h-2 flex-1 rounded bg-foreground/10" />
              <Send className="size-3.5 text-primary" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ children, agent }: { children: React.ReactNode; agent?: boolean }) {
  return (
    <div className={agent ? 'flex' : 'flex justify-end'}>
      <span
        className={
          agent
            ? 'max-w-[85%] rounded-2xl rounded-bs-sm bg-muted px-3 py-1.5 text-[11px]'
            : 'max-w-[85%] rounded-2xl rounded-be-sm bg-gradient-brand px-3 py-1.5 text-[11px] text-white'
        }
      >
        {children}
      </span>
    </div>
  );
}
