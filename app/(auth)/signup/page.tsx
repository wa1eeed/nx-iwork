import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  const t = useTranslations('auth');
  return (
    <Card>
      <CardHeader className="space-y-2 text-center">
        <CardTitle>{t('signupTitle')}</CardTitle>
        <CardDescription>{t('signupSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('signInLink')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
