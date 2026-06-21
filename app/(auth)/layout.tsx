import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('common');
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Animated aurora backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -start-24 -top-24 size-[30rem] rounded-full bg-brand-from/20 blur-[110px] animate-aurora" />
        <div
          className="absolute -bottom-24 -end-24 size-[30rem] rounded-full bg-brand-to/20 blur-[110px] animate-aurora"
          style={{ animationDelay: '-8s' }}
        />
      </div>

      <div className="absolute end-4 top-4 flex items-center gap-1">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow animate-float">
            <Sparkles className="size-6" />
          </span>
          <div>
            <p className="text-xl font-semibold tracking-tight">{t('appName')}</p>
            <p className="text-sm text-muted-foreground">{t('tagline')}</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
