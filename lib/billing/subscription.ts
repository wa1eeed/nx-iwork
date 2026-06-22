// Subscription billing — view the current plan, list invoices, and activate a
// plan paid either from the wallet (atomic debit) or via Tap (settled on the
// webhook/return). Plan rows live in the DB (seeded); Company.plan mirrors the
// active tier and drives the per-agent token cap.

import { Prisma, type PlanTier } from '@prisma/client';
import { db } from '@/lib/db';
import { round2 } from '@/lib/money';
import { agentTokenCap, ONBOARDING_PLANS } from '@/lib/plans';

const PERIOD_DAYS = 30;

// The tiers a customer can self-serve select.
export const SELECTABLE_TIERS: PlanTier[] = ['STARTER', 'GROWTH', 'SCALE'];

const FEATURE_KEYS: Partial<Record<PlanTier, string[]>> = Object.fromEntries(
  ONBOARDING_PLANS.map((p) => [p.tier, p.featureKeys])
);
const RECOMMENDED: Partial<Record<PlanTier, boolean>> = Object.fromEntries(
  ONBOARDING_PLANS.map((p) => [p.tier, Boolean(p.recommended)])
);

export interface PlanView {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  maxAgents: number;
  featureKeys: string[];
  recommended: boolean;
}

export interface InvoiceView {
  id: string;
  number: string;
  total: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface SubscriptionView {
  currentTier: PlanTier;
  status: string;
  currentPeriodEnd: string | null;
  walletBalance: number;
  plans: PlanView[];
  invoices: InvoiceView[];
}

function invoiceNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${date}-${rand}`;
}

export async function getSubscriptionView(
  companyId: string,
  locale = 'en'
): Promise<SubscriptionView> {
  const [company, sub, plans, invoices, wallet] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { plan: true } }),
    db.subscription.findUnique({
      where: { companyId },
      select: { status: true, currentPeriodEnd: true },
    }),
    db.plan.findMany({ where: { tier: { in: SELECTABLE_TIERS } }, orderBy: { sortOrder: 'asc' } }),
    db.invoice.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.wallet.findUnique({ where: { companyId }, select: { balance: true } }),
  ]);

  const ar = locale === 'ar';
  return {
    currentTier: company?.plan ?? 'STARTER',
    status: sub?.status ?? 'TRIAL',
    currentPeriodEnd: sub?.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    walletBalance: wallet ? wallet.balance.toNumber() : 0,
    plans: plans.map((p) => ({
      tier: p.tier,
      name: ar ? p.name : p.nameEn,
      priceMonthly: p.priceMonthly.toNumber(),
      maxAgents: p.maxAgents,
      featureKeys: FEATURE_KEYS[p.tier] ?? [],
      recommended: RECOMMENDED[p.tier] ?? false,
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      total: i.total.toNumber(),
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      paidAt: i.paidAt ? i.paidAt.toISOString() : null,
    })),
  };
}

// Activate `tier` for one period, write a PAID invoice, sync Company.plan + the
// per-agent token cap. Shared by the wallet and Tap-settle paths.
async function activate(
  tx: Prisma.TransactionClient,
  opts: {
    companyId: string;
    tier: PlanTier;
    price: number;
    payVia: 'wallet' | 'tap';
    providerInvoiceId?: string;
  }
) {
  const plan = await tx.plan.findUnique({ where: { tier: opts.tier } });
  if (!plan) throw new Error(`plan ${opts.tier} not found`);

  const now = new Date();
  const end = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const sub = await tx.subscription.upsert({
    where: { companyId: opts.companyId },
    create: {
      companyId: opts.companyId,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: end,
      provider: opts.payVia,
      interval: 'month',
    },
    update: {
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: end,
      provider: opts.payVia,
    },
  });

  await tx.invoice.create({
    data: {
      companyId: opts.companyId,
      subscriptionId: sub.id,
      number: invoiceNumber(),
      amount: opts.price,
      total: opts.price,
      status: 'PAID',
      paidAt: now,
      providerInvoiceId: opts.providerInvoiceId,
    },
  });

  await tx.company.update({
    where: { id: opts.companyId },
    data: { plan: opts.tier, status: 'ACTIVE' },
  });
  await tx.agent.updateMany({
    where: { companyId: opts.companyId },
    data: { tokenLimit: agentTokenCap(opts.tier) },
  });
}

export type WalletPayResult =
  | { ok: true }
  | { ok: false; reason: 'plan_not_found' | 'insufficient' };

// Pay for a plan by debiting the wallet — one atomic transaction.
export async function subscribeFromWallet(
  companyId: string,
  tier: PlanTier
): Promise<WalletPayResult> {
  return db.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { tier } });
    if (!plan) return { ok: false, reason: 'plan_not_found' };
    const price = round2(plan.priceMonthly.toNumber());

    if (price > 0) {
      const wallet = await tx.wallet.findUnique({
        where: { companyId },
        select: { id: true, balance: true },
      });
      if (!wallet || wallet.balance.toNumber() < price) {
        return { ok: false, reason: 'insufficient' };
      }
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: price } },
        select: { balance: true },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          companyId,
          type: 'SUBSCRIPTION',
          status: 'COMPLETED',
          amount: price,
          balanceAfter: updated.balance,
          description: `${plan.nameEn} plan`,
          metadata: { tier },
        },
      });
    }

    await activate(tx, { companyId, tier, price, payVia: 'wallet' });
    return { ok: true };
  });
}

// Settle a Tap-paid subscription. Idempotent: the unique providerInvoiceId means
// a racing webhook + return reconcile activates exactly once.
export async function settleSubscriptionPayment(
  companyId: string,
  tier: PlanTier,
  chargeId: string
): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.invoice.findFirst({
        where: { providerInvoiceId: chargeId },
        select: { id: true },
      });
      if (existing) return false;
      const plan = await tx.plan.findUnique({ where: { tier } });
      if (!plan) return false;
      await activate(tx, {
        companyId,
        tier,
        price: round2(plan.priceMonthly.toNumber()),
        payVia: 'tap',
        providerInvoiceId: chargeId,
      });
      return true;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false; // already settled (unique providerInvoiceId)
    }
    throw err;
  }
}

export function isSelectableTier(value: string): value is PlanTier {
  return (SELECTABLE_TIERS as string[]).includes(value);
}
