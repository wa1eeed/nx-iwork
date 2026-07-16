// Subscription auto-renewal engine — the recurring half of Tap billing.
//
// Every cron tick (/api/cron/run) calls runDueRenewals(): it scans ACTIVE/
// PAST_DUE subscriptions whose renewsAt has passed, holds a saved card, and
// charges it merchant-initiated (lib/payments/tap.chargeSavedCard). Success
// settles through the SAME idempotent settleSubscriptionPayment used by the
// webhook (Invoice.providerInvoiceId unique → the sync path and the async
// webhook converge on exactly one activation). Failure walks a dunning ladder
// (retry +1d, then +3d) and finally downgrades to FREE.
//
// Double-fire guard: renewsAt/lastAttemptAt are advanced BEFORE charging (the
// runDueSchedules advance-cursor-first pattern), so an overlapping tick or a
// crash mid-charge can't bill twice — and the webhook remains the safety net
// for a charge whose synchronous result was lost.

import type { PlanTier } from '@prisma/client';
import { db } from '@/lib/db';
import { round2 } from '@/lib/money';
import { agentTokenCap } from '@/lib/plans';
import { chargeSavedCard, isCaptured } from '@/lib/payments/tap';
import { settleSubscriptionPayment, cardFromCharge, isSelectableTier } from '@/lib/billing/subscription';
import { sendRenewalReceipt, sendRenewalFailed, sendSubscriptionEnded } from '@/lib/notifications/billing-emails';

const MAX_ATTEMPTS = 3; // initial try + 2 retries, then downgrade
const RETRY_DELAYS_H = [24, 72]; // attempt 1 failed → +24h; attempt 2 failed → +72h
const BATCH = 20; // renewals per tick — plenty at current scale

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 60 * 60 * 1000);
}

export interface RenewalRunSummary {
  due: number;
  renewed: number;
  failed: number;
  downgraded: number;
}

export async function runDueRenewals(now = new Date()): Promise<RenewalRunSummary> {
  const summary: RenewalRunSummary = { due: 0, renewed: 0, failed: 0, downgraded: 0 };

  const due = await db.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      autoRenew: true,
      renewsAt: { lte: now },
      cardId: { not: null },
      providerCustomerId: { not: null },
      // Owner-cancelled subscriptions stop at period end instead of renewing.
      OR: [{ cancelAt: null }, { cancelAt: { gt: now } }],
    },
    take: BATCH,
    select: {
      id: true,
      companyId: true,
      cardId: true,
      providerCustomerId: true,
      failedAttempts: true,
      plan: { select: { tier: true, priceMonthly: true, nameEn: true } },
    },
  });
  summary.due = due.length;

  for (const sub of due) {
    const tier = sub.plan.tier;
    if (!isSelectableTier(tier)) continue; // FREE/ENTERPRISE never auto-bill
    const price = round2(sub.plan.priceMonthly.toNumber());
    if (price <= 0) continue;

    // Advance the cursor FIRST so this row can't be picked up again this tick
    // (or by a racing worker) while the charge is in flight.
    await db.subscription.update({
      where: { id: sub.id },
      data: { lastAttemptAt: now, renewsAt: hoursFromNow(RETRY_DELAYS_H[0]) },
    });

    const charge = await chargeSavedCard({
      amount: price,
      companyId: sub.companyId,
      customerId: sub.providerCustomerId!,
      cardId: sub.cardId!,
      description: `${sub.plan.nameEn} plan renewal`,
      metadata: { kind: 'subscription_renewal', tier },
    });

    if (charge && isCaptured(charge)) {
      // settle resets renewsAt = new period end + failedAttempts = 0.
      const settled = await settleSubscriptionPayment(sub.companyId, tier, charge.id, cardFromCharge(charge));
      if (settled) {
        summary.renewed += 1;
        console.log(`[renewals] renewed ${tier} for ${sub.companyId} (${charge.id})`);
        void sendRenewalReceipt(sub.companyId, { tier, amount: price, chargeId: charge.id }).catch((err) =>
          console.error('[renewals] receipt email failed', err)
        );
      }
    } else {
      summary.failed += 1;
      const outcome = await recordRenewalFailure(sub.companyId, charge?.id ?? null);
      if (outcome === 'downgraded') summary.downgraded += 1;
    }
  }

  return summary;
}

// Shared by the engine's synchronous failure path AND the webhook (a renewal
// charge that failed asynchronously). Walks the dunning ladder; at the cap it
// downgrades the company to FREE. Idempotent enough for both to fire: the
// attempt counter only ever moves the schedule out, and downgrade is terminal.
export async function recordRenewalFailure(
  companyId: string,
  chargeId: string | null
): Promise<'retry' | 'downgraded' | 'noop'> {
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { id: true, failedAttempts: true, status: true, plan: { select: { tier: true } } },
  });
  if (!sub || sub.status === 'EXPIRED' || sub.status === 'CANCELLED') return 'noop';

  const attempts = sub.failedAttempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    const downTier: PlanTier = 'FREE';
    await db.$transaction([
      db.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED', failedAttempts: attempts, autoRenew: false, renewsAt: null },
      }),
      db.company.update({ where: { id: companyId }, data: { plan: downTier } }),
      db.agent.updateMany({ where: { companyId }, data: { tokenLimit: agentTokenCap(downTier) } }),
    ]);
    console.warn(`[renewals] downgraded ${companyId} to ${downTier} after ${attempts} failed attempts (${chargeId ?? 'no-charge'})`);
    void sendSubscriptionEnded(companyId, { tier: sub.plan.tier }).catch((err) =>
      console.error('[renewals] ended email failed', err)
    );
    return 'downgraded';
  }

  const delayH = RETRY_DELAYS_H[Math.min(attempts - 1, RETRY_DELAYS_H.length - 1)];
  await db.subscription.update({
    where: { id: sub.id },
    data: { status: 'PAST_DUE', failedAttempts: attempts, renewsAt: hoursFromNow(delayH) },
  });
  console.warn(`[renewals] payment failed for ${companyId} (attempt ${attempts}/${MAX_ATTEMPTS}, retry in ${delayH}h)`);
  void sendRenewalFailed(companyId, { tier: sub.plan.tier, attempt: attempts, maxAttempts: MAX_ATTEMPTS }).catch(
    (err) => console.error('[renewals] dunning email failed', err)
  );
  return 'retry';
}
