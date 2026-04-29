'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  createCompanyForUser,
  getUserCompany,
  isUniqueConstraintError,
} from '@/lib/companies';
import { onboardingSchema, type OnboardingInput } from '@/lib/validators/onboarding';

export type OnboardingActionResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'already_onboarded' | 'validation' | 'slug_taken' | 'generic' };

export async function createCompanyAction(
  raw: OnboardingInput
): Promise<OnboardingActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: 'unauthenticated' };
  }

  // Idempotency: if a previous submission already created the company, don't
  // create a second one. Caller is expected to redirect afterwards.
  const existing = await getUserCompany(session.user.id);
  if (existing) {
    return { ok: false, error: 'already_onboarded' };
  }

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'validation' };
  }

  try {
    await createCompanyForUser({
      userId: session.user.id,
      name: parsed.data.name,
      nameEn: parsed.data.nameEn ?? null,
      industry: parsed.data.industry ?? null,
      teamSize: parsed.data.teamSize ?? null,
      mainGoal: parsed.data.mainGoal ?? null,
      vision: parsed.data.vision ?? null,
      preferredSlug: parsed.data.slug ?? null,
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { ok: false, error: 'slug_taken' };
    }
    console.error('createCompanyAction failed', err);
    return { ok: false, error: 'generic' };
  }

  // redirect() throws an internal Next signal — must be outside the try/catch
  // so it isn't swallowed as a generic error.
  redirect('/overview');
}
