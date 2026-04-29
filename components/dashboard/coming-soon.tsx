import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export async function ComingSoon({
  titleKey,
  sprint,
}: {
  titleKey: 'agents' | 'departments' | 'tasks' | 'chat';
  sprint: number;
}) {
  const t = await getTranslations('dashboard');
  const tc = await getTranslations('comingSoon');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t(titleKey)}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Hourglass className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{tc('title')}</CardTitle>
            <CardDescription className="mt-1">
              {tc('body', { sprint })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" variant="outline">
            <Link href="/overview">
              {tc('backToOverview')}
              <ArrowRight className="ms-1 h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
