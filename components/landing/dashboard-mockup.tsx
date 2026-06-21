import { useTranslations } from 'next-intl';
import {
  Sparkles,
  Bot,
  Headphones,
  Megaphone,
  ShoppingBag,
  Check,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// A code-built mock of the NX iWork dashboard (an org chart of AI employees) with
// floating notification cards — the hero centerpiece. No screenshots: everything
// is rendered, so it stays crisp at any size and theme.
export function DashboardMockup() {
  const t = useTranslations('landing.mock');
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div aria-hidden className="absolute inset-6 -z-10 rounded-[2rem] bg-gradient-brand opacity-20 blur-3xl" />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-elevated ring-1 ring-foreground/5">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-amber-400/80" />
          <span className="size-3 rounded-full bg-emerald-400/80" />
          <div className="ms-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded-md bg-gradient-brand text-white">
              <Sparkles className="size-3" />
            </span>
            {t('appTitle')}
          </div>
        </div>

        <div className="bg-gradient-to-b from-muted/40 to-transparent px-6 py-8">
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('orgTitle')}
          </p>
          <div className="flex flex-col items-center">
            <Node label={t('ceo')} icon={Sparkles} accent />
            <Line />
            <Node label={t('hr')} icon={Bot} />
            <Line />
            <div className="flex items-start gap-2 sm:gap-4">
              <Node label="Sales" icon={ShoppingBag} small />
              <Node label="Support" icon={Headphones} small />
              <Node label="Marketing" icon={Megaphone} small />
            </div>
          </div>
        </div>
      </div>

      <FloatCard className="-start-3 top-12 hidden sm:flex" delay="-1s" tone="emerald" icon={Check} text={t('hired')} />
      <FloatCard className="-end-4 top-28" delay="-3s" tone="violet" icon={ShoppingBag} text={t('order')} />
      <FloatCard className="-end-1 -bottom-3 hidden sm:flex" delay="-2s" tone="amber" icon={AlertTriangle} text={t('escalated')} />
    </div>
  );
}

function Node({ label, icon: Icon, accent, small }: { label: string; icon: LucideIcon; accent?: boolean; small?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-card',
        accent && 'ring-gradient',
        small && 'flex-col gap-1 px-2.5 py-2 text-center'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-lg text-white',
          accent ? 'bg-gradient-brand' : 'bg-primary',
          small ? 'size-7' : 'size-8'
        )}
      >
        <Icon className={small ? 'size-3.5' : 'size-4'} />
      </span>
      <span className={cn('font-medium', small ? 'text-[11px]' : 'text-sm')}>{label}</span>
    </div>
  );
}

function Line() {
  return <span aria-hidden className="my-1.5 h-4 w-px bg-border" />;
}

const TONES: Record<string, string> = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  violet: 'text-violet-600 dark:text-violet-400',
  amber: 'text-amber-600 dark:text-amber-400',
};

function FloatCard({
  className,
  delay,
  tone,
  icon: Icon,
  text,
}: {
  className?: string;
  delay: string;
  tone: keyof typeof TONES | string;
  icon: LucideIcon;
  text: string;
}) {
  return (
    <div
      className={cn(
        'absolute z-10 inline-flex max-w-[12rem] items-center gap-2 rounded-xl border bg-card/90 px-3 py-2 text-xs font-medium shadow-elevated backdrop-blur animate-float',
        className
      )}
      style={{ animationDelay: delay }}
    >
      <Icon className={cn('size-4 shrink-0', TONES[tone] ?? '')} />
      <span className="truncate">{text}</span>
    </div>
  );
}
