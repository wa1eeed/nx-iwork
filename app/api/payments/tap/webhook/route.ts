import { NextResponse } from 'next/server';
import { retrieveCharge, isCaptured, isFailure } from '@/lib/payments/tap';
import { completeTopUp, failTopUp } from '@/lib/wallet';
import { settleSubscriptionPayment, cardFromCharge, isSelectableTier } from '@/lib/billing/subscription';
import { recordRenewalFailure } from '@/lib/billing/renewals';

export const dynamic = 'force-dynamic';

// Tap posts charge updates here. We treat the body only as a hint (a charge id)
// and re-fetch the authoritative charge from Tap with our secret key before
// crediting — so a forged webhook can't move money. Idempotent: completeTopUp
// only ever credits the first time a charge is captured.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const chargeId =
    (body as { id?: string })?.id ??
    (body as { charge?: { id?: string } })?.charge?.id ??
    null;
  if (!chargeId || typeof chargeId !== 'string') {
    return NextResponse.json({ ok: true });
  }

  const charge = await retrieveCharge(chargeId);
  if (!charge) return NextResponse.json({ ok: true });

  try {
    const kind = String(charge.metadata?.kind ?? 'topup');
    if (isCaptured(charge)) {
      if (kind === 'subscription' || kind === 'subscription_renewal') {
        const companyId = String(charge.metadata?.companyId ?? '');
        const tier = String(charge.metadata?.tier ?? '');
        if (companyId && isSelectableTier(tier)) {
          // Store the saved-card token (present on save_card checkouts +
          // merchant-initiated renewals) so auto-renewal stays armed.
          const settled = await settleSubscriptionPayment(companyId, tier, charge.id, cardFromCharge(charge));
          if (settled) console.log(`[tap webhook] activated ${tier} for ${companyId} (${charge.id}, ${kind})`);
        }
      } else {
        const res = await completeTopUp(charge.id);
        if (res.credited) {
          console.log(`[tap webhook] credited top-up ${charge.id} (balance=${res.balance})`);
        }
      }
    } else if (isFailure(charge)) {
      if (kind === 'subscription_renewal') {
        // A failed renewal drives dunning even when the engine missed the
        // synchronous failure (crash/timeout between charge and record).
        const companyId = String(charge.metadata?.companyId ?? '');
        if (companyId) await recordRenewalFailure(companyId, charge.id);
      } else if (kind === 'topup') {
        await failTopUp(charge.id);
      }
      // A failed first subscription checkout needs no state change: nothing was
      // activated and the buyer simply retries from /subscription.
    }
  } catch (err) {
    console.error('[tap webhook] processing failed', err);
  }
  return NextResponse.json({ ok: true });
}
