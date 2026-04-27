'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signupSchema, type SignupInput } from '@/lib/validators/auth';

type ErrorKey =
  | 'nameRequired'
  | 'invalidEmail'
  | 'weakPassword'
  | 'emailExists'
  | 'invalidCredentials'
  | 'generic';

export function SignupForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  function onSubmit(values: SignupInput) {
    setServerError(null);
    startTransition(async () => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: ErrorKey }
          | null;
        const key: ErrorKey = data?.error ?? 'generic';
        setServerError(t(`errors.${key}`));
        return;
      }

      toast.success(t('success.signupCreated'));

      const signInRes = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!signInRes || signInRes.error) {
        router.push('/login');
        return;
      }
      router.push('/overview');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">{t('name')}</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder={t('namePlaceholder')}
          disabled={isPending}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{t('errors.nameRequired')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          disabled={isPending}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{t('errors.invalidEmail')}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordPlaceholder')}
          disabled={isPending}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{t('errors.weakPassword')}</p>
        )}
      </div>

      {serverError && (
        <p className="text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {t('signupCta')}
      </Button>
    </form>
  );
}
