import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function OverviewPage() {
  const session = await auth();
  const t = await getTranslations('dashboard');
  const name = session?.user?.name ?? '';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('welcomeBack', { name })}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('overview')}</CardTitle>
          <CardDescription>{t('emptyStateTitle')}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t('emptyStateBody')}
        </CardContent>
      </Card>
    </div>
  );
}
