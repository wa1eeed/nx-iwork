'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@/i18n/request';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setLocale(locale: SupportedLocale) {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
}
