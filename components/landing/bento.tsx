import {
  Bot,
  MessageCircle,
  Send,
  Globe,
  CalendarCheck,
  Contact,
  Zap,
  Database,
  Plug,
  Cpu,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { RevealGroup, RevealItem } from '@/components/ui/motion';

// ONE asymmetric bento replaces the three near-identical 3-col card grids the
// landing used to stack (18 same-shaped cards). Each cell pairs a capability
// with a small code-built visual — no screenshots, stays crisp in both themes
// and both directions. Labels reuse the existing landing.* i18n keys.
export async function Bento() {
  const t = await getTranslations('landing');

  return (
    <RevealGroup className="grid auto-rows-[minmax(0,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1 — AI employees (the flagship cell) */}
      <RevealItem className="sm:col-span-2 lg:row-span-2">
        <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 size-48 rounded-full bg-gradient-brand opacity-10 blur-3xl transition-opacity group-hover:opacity-20" />
          <div className="space-y-2.5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Bot className="size-5" />
            </span>
            <h3 className="text-lg font-semibold">{t('capabilities.items.employees.name')}</h3>
            <p className="text-sm text-muted-foreground">{t('capabilities.items.employees.desc')}</p>
          </div>
          {/* Mini workforce visual */}
          <div className="mt-6 space-y-2">
            {(['a1', 'a2', 'a3'] as const).map((k, i) => (
              <div
                key={k}
                className="flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2 backdrop-blur transition-transform group-hover:translate-x-0.5"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white">
                  {t(`bento.agents.${k}.initial`)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{t(`bento.agents.${k}.name`)}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{t(`bento.agents.${k}.role`)}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="size-1 rounded-full bg-emerald-500" />
                  {t('bento.working')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </RevealItem>

      {/* 2 — Omnichannel */}
      <RevealItem className="sm:col-span-2">
        <div className="group flex h-full flex-col justify-between rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <div className="space-y-2.5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="size-5" />
            </span>
            <h3 className="font-semibold">{t('capabilities.items.omnichannel.name')}</h3>
            <p className="text-sm text-muted-foreground">{t('capabilities.items.omnichannel.desc')}</p>
          </div>
          <div className="mt-5 flex items-center gap-2.5">
            {[
              { icon: MessageCircle, label: 'WhatsApp', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
              { icon: Send, label: 'Telegram', cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
              { icon: Globe, label: t('bento.webChannel'), cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
            ].map(({ icon: Icon, label, cls }) => (
              <span key={label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${cls}`}>
                <Icon className="size-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </RevealItem>

      {/* 3 — Bookings */}
      <RevealItem>
        <div className="group flex h-full flex-col rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <span className="flex size-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <CalendarCheck className="size-5" />
          </span>
          <h3 className="mt-2.5 font-semibold">{t('modules.items.bookings.name')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('modules.items.bookings.desc')}</p>
          <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden>
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full ${[2, 5, 9, 12].includes(i) ? 'bg-gradient-brand' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>
      </RevealItem>

      {/* 4 — CRM */}
      <RevealItem>
        <div className="group flex h-full flex-col rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <span className="flex size-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Contact className="size-5" />
          </span>
          <h3 className="mt-2.5 font-semibold">{t('modules.items.crm.name')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('modules.items.crm.desc')}</p>
        </div>
      </RevealItem>

      {/* 5 — Autonomous + governance */}
      <RevealItem className="sm:col-span-2">
        <div className="group flex h-full flex-col justify-between rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <div className="space-y-2.5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="size-5" />
            </span>
            <h3 className="font-semibold">{t('capabilities.items.autonomous.name')}</h3>
            <p className="text-sm text-muted-foreground">{t('capabilities.items.autonomous.desc')}</p>
          </div>
          {/* Governance mini-visual */}
          <div className="mt-5 space-y-2">
            {(['g1', 'g2'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between rounded-xl border bg-background/60 px-3 py-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium">
                  <ShieldCheck className="size-3.5 text-primary" />
                  {t(`bento.guardrails.${k}`)}
                </span>
                <span className="relative h-5 w-9 rounded-full bg-gradient-brand" aria-hidden>
                  <span className="absolute end-0.5 top-0.5 size-4 rounded-full bg-white shadow" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </RevealItem>

      {/* 6 — Any sector (Business Objects) */}
      <RevealItem className="sm:col-span-2">
        <div className="group flex h-full flex-col justify-between rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <div className="space-y-2.5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Database className="size-5" />
            </span>
            <h3 className="font-semibold">{t('capabilities.items.anySector.name')}</h3>
            <p className="text-sm text-muted-foreground">{t('capabilities.items.anySector.desc')}</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(['clinics', 'salons', 'fitness', 'repair', 'consulting'] as const).map((k) => (
              <span key={k} className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                {t(`sectors.items.${k}`)}
              </span>
            ))}
          </div>
        </div>
      </RevealItem>

      {/* 7 — MCP connect */}
      <RevealItem>
        <div className="group flex h-full flex-col rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <span className="flex size-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Plug className="size-5" />
          </span>
          <h3 className="mt-2.5 font-semibold">{t('capabilities.items.connect.name')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('capabilities.items.connect.desc')}</p>
        </div>
      </RevealItem>

      {/* 8 — Model choice */}
      <RevealItem>
        <div className="group flex h-full flex-col rounded-3xl border bg-card p-6 transition hover:border-primary/40 hover:shadow-elevated">
          <span className="flex size-11 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
            <Cpu className="size-5" />
          </span>
          <h3 className="mt-2.5 font-semibold">{t('capabilities.items.models.name')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('capabilities.items.models.desc')}</p>
        </div>
      </RevealItem>

      {/* 9 — And-more strip (folds the old features grid into one honest row) */}
      <RevealItem className="sm:col-span-2 lg:col-span-4">
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-3xl border bg-card/60 px-6 py-5 backdrop-blur">
          {(['waitlist', 'coupons', 'inventory', 'commissions', 'unified'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Check className="size-3.5 text-primary" />
              {t(`features.items.${k}.title`)}
            </span>
          ))}
        </div>
      </RevealItem>
    </RevealGroup>
  );
}
