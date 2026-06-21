'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { round2 } from '@/lib/money';
import { createPendingTopUp, purchaseTokenCredits } from '@/lib/wallet';
import { createCharge, isTapConfigured } from '@/lib/payments/tap';

const MIN_TOPUP = 10;
const MAX_TOPUP = 50_000;

async function appOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (env) return env;
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

export type TopUpResult =
  | { ok: true; url: string }
  | { ok: false; error: 'unauthorized' | 'invalid' | 'unconfigured' | 'generic' };

// Create a Tap charge for a wallet top-up and return its hosted-page URL. The
// caller redirects the browser there; the balance is credited on capture (by
// the webhook / return reconcile), never here.
export async function startWalletTopUp(amount: number): Promise<TopUpResult> {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId || !session?.user) return { ok: false, error: 'unauthorized' };

  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt < MIN_TOPUP || amt > MAX_TOPUP) {
    return { ok: false, error: 'invalid' };
  }
  if (!isTapConfigured()) return { ok: false, error: 'unconfigured' };

  try {
    const origin = await appOrigin();
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    const charge = await createCharge({
      amount: amt,
      companyId,
      customer: { name: session.user.name ?? company?.name, email: session.user.email },
      redirectUrl: `${origin}/wallet?topup=return`,
      postUrl: `${origin}/api/payments/tap/webhook`,
      description: 'Wallet top-up',
    });
    if (!charge) return { ok: false, error: 'generic' };

    await createPendingTopUp({
      companyId,
      amount: amt,
      reference: charge.id,
      description: 'Wallet top-up',
    });
    return { ok: true, url: charge.url };
  } catch (err) {
    console.error('startWalletTopUp failed', err);
    return { ok: false, error: 'generic' };
  }
}

export type BuyCreditsResult =
  | { ok: true; tokensAdded: number; balance: number }
  | { ok: false; error: 'unauthorized' | 'invalid' | 'insufficient' | 'generic' };

// Spend wallet money on AI token credits (admin-priced per 1M tokens).
export async function buyTokenCredits(millions: number): Promise<BuyCreditsResult> {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) return { ok: false, error: 'unauthorized' };

  const m = Math.floor(Number(millions));
  if (!Number.isFinite(m) || m <= 0 || m > 1000) return { ok: false, error: 'invalid' };

  try {
    const settings = await db.platformSettings.findUnique({
      where: { id: 'singleton' },
      select: { tokenPricePerMillion: true },
    });
    const pricePerMillion = settings ? settings.tokenPricePerMillion.toNumber() : 5;

    const result = await purchaseTokenCredits({ companyId, millions: m, pricePerMillion });
    if (!result.ok) {
      return { ok: false, error: result.reason === 'insufficient' ? 'insufficient' : 'invalid' };
    }
    revalidatePath('/wallet');
    revalidatePath('/overview');
    return { ok: true, tokensAdded: result.tokensAdded, balance: result.balance };
  } catch (err) {
    console.error('buyTokenCredits failed', err);
    return { ok: false, error: 'generic' };
  }
}
