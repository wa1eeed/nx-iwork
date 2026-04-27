import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  const t = useTranslations('auth');
  return (
    <Card>
      <CardHeader className="space-y-2 text-center">
        <CardTitle>{t('loginTitle')}</CardTitle>
        <CardDescription>{t('loginSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          {t('dontHaveAccount')}{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t('signUpLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
