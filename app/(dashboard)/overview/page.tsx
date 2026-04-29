import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertCircle, ArrowRight, Settings, Sparkles } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      companyId: true,
      company: {
        select: {
          name: true,
          apiSettings: {
            select: { byokApiKey: true, byokVerified: true },
          },
        },
      },
    },
  });

  // Layout already enforces this, but a defensive check keeps the types tight.
  if (!user?.companyId || !user.company) redirect('/onboarding');

  const t = await getTranslations('dashboard');
  const name = session.user.name ?? '';
  const companyName = user.company.name;
  const hasVerifiedKey =
    !!user.company.apiSettings?.byokApiKey &&
    user.company.apiSettings.byokVerified;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('welcomeBack', { name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('companySuffix', { company: companyName })}
        </p>
      </div>

      {!hasVerifiedKey && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <CardTitle className="text-base">
                {t('byokWarningTitle')}
              </CardTitle>
              <CardDescription className="mt-1">
                {t('byokWarningBody')}
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings">
                {t('byokWarningCta')}
                <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {t('quickActions')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="opacity-60">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">{t('addAgentTitle')}</CardTitle>
              <CardDescription>{t('addAgentBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled size="sm" variant="secondary">
                {t('addAgentCta')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">
                {t('openSettingsTitle')}
              </CardTitle>
              <CardDescription>{t('openSettingsBody')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm">
                <Link href="/settings">
                  {t('openSettingsCta')}
                  <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
