import { NextResponse } from 'next/server';
import { retrieveCharge, isCaptured, isFailure } from '@/lib/payments/tap';
import { completeTopUp, failTopUp } from '@/lib/wallet';
import { settleSubscriptionPayment, isSelectableTier } from '@/lib/billing/subscription';

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
    if (isCaptured(charge)) {
      const kind = String(charge.metadata?.kind ?? 'topup');
      if (kind === 'subscription') {
        const companyId = String(charge.metadata?.companyId ?? '');
        const tier = String(charge.metadata?.tier ?? '');
        if (companyId && isSelectableTier(tier)) {
          const settled = await settleSubscriptionPayment(companyId, tier, charge.id);
          if (settled) console.log(`[tap webhook] activated ${tier} for ${companyId} (${charge.id})`);
        }
      } else {
        const res = await completeTopUp(charge.id);
        if (res.credited) {
          console.log(`[tap webhook] credited top-up ${charge.id} (balance=${res.balance})`);
        }
      }
    } else if (isFailure(charge)) {
      await failTopUp(charge.id);
    }
  } catch (err) {
    console.error('[tap webhook] processing failed', err);
  }
  return NextResponse.json({ ok: true });
}
