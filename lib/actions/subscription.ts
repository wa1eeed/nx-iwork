'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { subscribeFromWallet, isSelectableTier } from '@/lib/billing/subscription';
import { createCharge, isTapConfigured } from '@/lib/payments/tap';

async function appOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (env) return env;
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

export type SubscribeResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'invalid' | 'insufficient' | 'plan_not_found' | 'generic' };

// Toggle auto-renewal. Off = the subscription simply lapses at period end
// (cancelAt stamps the intent); On = the renewal engine charges the saved card.
export async function setAutoRenew(enabled: boolean): Promise<SubscribeResult> {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) return { ok: false, error: 'unauthorized' };
  try {
    const sub = await db.subscription.findUnique({
      where: { companyId },
      select: { id: true, currentPeriodEnd: true },
    });
    if (!sub) return { ok: false, error: 'invalid' };
    await db.subscription.update({
      where: { id: sub.id },
      data: enabled
        ? { autoRenew: true, cancelAt: null, cancelledAt: null, renewsAt: sub.currentPeriodEnd }
        : { autoRenew: false, cancelAt: sub.currentPeriodEnd, cancelledAt: new Date() },
    });
    revalidatePath('/subscription');
    return { ok: true };
  } catch (err) {
    console.error('setAutoRenew failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Pay for a plan from the wallet balance.
export async function subscribeWithWallet(tier: string): Promise<SubscribeResult> {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) return { ok: false, error: 'unauthorized' };
  if (!isSelectableTier(tier)) return { ok: false, error: 'invalid' };

  try {
    const res = await subscribeFromWallet(companyId, tier);
    if (!res.ok) return { ok: false, error: res.reason };
    revalidatePath('/subscription');
    revalidatePath('/overview');
    revalidatePath('/wallet');
    return { ok: true };
  } catch (err) {
    console.error('subscribeWithWallet failed', err);
    return { ok: false, error: 'generic' };
  }
}

export type TapCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: 'unauthorized' | 'invalid' | 'unconfigured' | 'free' | 'generic' };

// Pay for a plan directly via Tap (card / Apple Pay on the hosted page).
export async function startSubscriptionTapCheckout(tier: string): Promise<TapCheckoutResult> {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId || !session?.user) return { ok: false, error: 'unauthorized' };
  if (!isSelectableTier(tier)) return { ok: false, error: 'invalid' };
  if (!isTapConfigured()) return { ok: false, error: 'unconfigured' };

  const plan = await db.plan.findUnique({
    where: { tier },
    select: { priceMonthly: true, nameEn: true },
  });
  if (!plan) return { ok: false, error: 'invalid' };
  const price = plan.priceMonthly.toNumber();
  if (price <= 0) return { ok: false, error: 'free' };

  try {
    const origin = await appOrigin();
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    const charge = await createCharge({
      amount: price,
      companyId,
      customer: { name: session.user.name ?? company?.name, email: session.user.email },
      redirectUrl: `${origin}/subscription?sub=return`,
      postUrl: `${origin}/api/payments/tap/webhook`,
      description: `${plan.nameEn} plan subscription`,
      metadata: { kind: 'subscription', tier },
      // Tokenize the card so the renewal engine can charge it next period.
      saveCard: true,
    });
    if (!charge) return { ok: false, error: 'generic' };
    return { ok: true, url: charge.url };
  } catch (err) {
    console.error('startSubscriptionTapCheckout failed', err);
    return { ok: false, error: 'generic' };
  }
}
