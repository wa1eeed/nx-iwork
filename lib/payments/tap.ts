// Tap.company payment integration for wallet top-ups.
//
// Flow: createCharge() returns a hosted payment-page URL we redirect the buyer
// to. Tap then (a) POSTs to our webhook and (b) redirects the buyer back. We
// NEVER trust the webhook/redirect body for the amount or status — we re-fetch
// the charge from Tap with our secret key (retrieveCharge) and act on that
// authoritative result. Keys: TAP_SECRET_KEY (required), set in the host env.
// Docs: https://developers.tap.company/reference/charges

import { round2 } from '@/lib/money';

const TAP_API = 'https://api.tap.company/v2';

export interface TapCharge {
  id: string;
  status: string; // INITIATED | CAPTURED | FAILED | DECLINED | CANCELLED | VOID | ...
  amount: number;
  currency: string;
  transaction?: { url?: string };
  reference?: { transaction?: string; order?: string };
  metadata?: Record<string, unknown>;
  // Present on charges made with save_card:true (after capture) — the token
  // pair that enables merchant-initiated renewal charges.
  customer?: { id?: string };
  card?: { id?: string; brand?: string; last_four?: string };
}

export function isTapConfigured(): boolean {
  return Boolean(process.env.TAP_SECRET_KEY);
}

export function isCaptured(charge: TapCharge): boolean {
  return charge.status === 'CAPTURED';
}

export function isFailure(charge: TapCharge): boolean {
  return ['FAILED', 'DECLINED', 'CANCELLED', 'VOID', 'TIMEDOUT'].includes(charge.status);
}

interface CreateChargeInput {
  amount: number;
  companyId: string;
  customer: { name?: string | null; email?: string | null };
  redirectUrl: string;
  postUrl: string;
  description?: string;
  // Extra metadata echoed back on the charge (e.g. { kind: 'subscription', tier }).
  metadata?: Record<string, string>;
  // Tokenize the card on this charge (subscription checkouts) so renewals can
  // charge it merchant-initiated later. The token is read off retrieveCharge
  // at settle time (charge.customer.id + charge.card.id).
  saveCard?: boolean;
}

export async function createCharge(
  input: CreateChargeInput
): Promise<{ id: string; url: string } | null> {
  const key = process.env.TAP_SECRET_KEY;
  if (!key) return null;

  const parts = (input.customer.name ?? 'Customer').trim().split(/\s+/);
  const firstName = parts[0] || 'Customer';
  const lastName = parts.slice(1).join(' ') || 'User';

  const body = {
    amount: round2(input.amount),
    currency: 'SAR',
    threeDSecure: true,
    save_card: input.saveCard === true,
    description: input.description ?? 'Wallet top-up',
    metadata: { companyId: input.companyId, kind: 'topup', ...input.metadata },
    customer: {
      first_name: firstName,
      last_name: lastName,
      ...(input.customer.email ? { email: input.customer.email } : {}),
    },
    source: { id: 'src_all' },
    redirect: { url: input.redirectUrl },
    post: { url: input.postUrl },
  };

  try {
    const res = await fetch(`${TAP_API}/charges`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('[tap] createCharge failed', res.status, await safeText(res));
      return null;
    }
    const charge = (await res.json()) as TapCharge;
    const url = charge.transaction?.url;
    if (!charge.id || !url) {
      console.error('[tap] createCharge: missing id/url in response');
      return null;
    }
    return { id: charge.id, url };
  } catch (err) {
    console.error('[tap] createCharge error', err);
    return null;
  }
}

// Merchant-initiated renewal charge against a saved card — no hosted page, no
// redirect. The caller (renewal engine) inspects the returned charge status
// synchronously; the webhook fires too, and both paths converge on the same
// idempotent settle (Invoice.providerInvoiceId unique).
export async function chargeSavedCard(input: {
  amount: number;
  companyId: string;
  customerId: string; // Tap cus_xxx
  cardId: string; // Tap card_xxx
  description?: string;
  metadata?: Record<string, string>;
}): Promise<TapCharge | null> {
  const key = process.env.TAP_SECRET_KEY;
  if (!key) return null;
  const body = {
    amount: round2(input.amount),
    currency: 'SAR',
    threeDSecure: false, // merchant-initiated; issuer may still enforce
    save_card: false,
    merchant_initiated: true,
    description: input.description ?? 'Subscription renewal',
    metadata: { companyId: input.companyId, ...input.metadata },
    customer: { id: input.customerId },
    source: { id: input.cardId },
  };
  try {
    const res = await fetch(`${TAP_API}/charges`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('[tap] chargeSavedCard failed', res.status, await safeText(res));
      return null;
    }
    return (await res.json()) as TapCharge;
  } catch (err) {
    console.error('[tap] chargeSavedCard error', err);
    return null;
  }
}

export async function retrieveCharge(id: string): Promise<TapCharge | null> {
  const key = process.env.TAP_SECRET_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${TAP_API}/charges/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error('[tap] retrieveCharge failed', res.status);
      return null;
    }
    return (await res.json()) as TapCharge;
  } catch (err) {
    console.error('[tap] retrieveCharge error', err);
    return null;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
}
