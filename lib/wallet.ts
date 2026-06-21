// Wallet operations — a prepaid SAR balance per company with an append-only
// transaction ledger. All balance mutations run inside a DB transaction and
// record a WalletTransaction so the ledger always reconciles with the balance.

import { Prisma, type WalletTxType } from '@prisma/client';
import { db } from '@/lib/db';
import { round2 } from '@/lib/money';

export async function getOrCreateWallet(companyId: string) {
  return db.wallet.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
}

export interface WalletTxView {
  id: string;
  type: WalletTxType;
  status: string;
  amount: number;
  balanceAfter: number | null;
  description: string | null;
  createdAt: string;
}

export interface WalletSummary {
  balance: number;
  currency: string;
  transactions: WalletTxView[];
}

export async function getWalletSummary(companyId: string, take = 50): Promise<WalletSummary> {
  const wallet = await getOrCreateWallet(companyId);
  const txs = await db.walletTransaction.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return {
    balance: wallet.balance.toNumber(),
    currency: wallet.currency,
    transactions: txs.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amount: t.amount.toNumber(),
      balanceAfter: t.balanceAfter ? t.balanceAfter.toNumber() : null,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

// Generic credit (refunds, manual admin top-up). Records a COMPLETED tx.
export async function creditWallet(opts: {
  companyId: string;
  amount: number;
  type: WalletTxType;
  reference?: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<number> {
  const amount = round2(opts.amount);
  if (!(amount > 0)) throw new Error('credit amount must be positive');
  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { companyId: opts.companyId },
      create: { companyId: opts.companyId },
      update: {},
    });
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        companyId: opts.companyId,
        type: opts.type,
        status: 'COMPLETED',
        amount,
        balanceAfter: updated.balance,
        reference: opts.reference,
        description: opts.description,
        ...(opts.metadata !== undefined ? { metadata: opts.metadata } : {}),
      },
    });
    return updated.balance.toNumber();
  });
}

// Record an unsettled top-up keyed by the Tap charge id. Settled later by
// completeTopUp once the charge is captured.
export async function createPendingTopUp(opts: {
  companyId: string;
  amount: number;
  reference: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  const amount = round2(opts.amount);
  const wallet = await getOrCreateWallet(opts.companyId);
  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      companyId: opts.companyId,
      type: 'TOPUP',
      status: 'PENDING',
      amount,
      reference: opts.reference,
      description: opts.description,
      ...(opts.metadata !== undefined ? { metadata: opts.metadata } : {}),
    },
  });
}

// Settle a pending top-up. Idempotent + concurrency-safe: the PENDING→COMPLETED
// flip is a single conditional updateMany, so a racing webhook + redirect can
// never double-credit (only the claim that flips exactly one row credits).
export async function completeTopUp(reference: string): Promise<{ credited: boolean; balance?: number }> {
  return db.$transaction(async (tx) => {
    const claim = await tx.walletTransaction.updateMany({
      where: { reference, type: 'TOPUP', status: 'PENDING' },
      data: { status: 'COMPLETED' },
    });
    if (claim.count !== 1) return { credited: false };

    const txn = await tx.walletTransaction.findUnique({ where: { reference } });
    if (!txn) return { credited: false };

    const updated = await tx.wallet.update({
      where: { id: txn.walletId },
      data: { balance: { increment: txn.amount } },
      select: { balance: true },
    });
    await tx.walletTransaction.update({
      where: { id: txn.id },
      data: { balanceAfter: updated.balance },
    });
    return { credited: true, balance: updated.balance.toNumber() };
  });
}

export async function failTopUp(reference: string): Promise<void> {
  await db.walletTransaction.updateMany({
    where: { reference, type: 'TOPUP', status: 'PENDING' },
    data: { status: 'FAILED' },
  });
}

export type SpendResult =
  | { ok: true; balance: number; tokensAdded: number; tokenBalance: number }
  | { ok: false; reason: 'insufficient' | 'invalid' };

// Spend wallet money on AI token credits: debit the wallet and increment the
// company token bank in one atomic transaction. `millions` = how many 1,000,000
// token units to buy at `pricePerMillion` SAR each.
export async function purchaseTokenCredits(opts: {
  companyId: string;
  millions: number;
  pricePerMillion: number;
}): Promise<SpendResult> {
  const millions = Math.floor(opts.millions);
  if (!(millions > 0)) return { ok: false, reason: 'invalid' };
  const cost = round2(millions * opts.pricePerMillion);
  const tokensAdded = millions * 1_000_000;

  return db.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { companyId: opts.companyId },
      select: { id: true, balance: true },
    });
    if (!wallet || wallet.balance.toNumber() < cost) return { ok: false, reason: 'insufficient' };

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: cost } },
      select: { balance: true },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        companyId: opts.companyId,
        type: 'TOKEN_PURCHASE',
        status: 'COMPLETED',
        amount: cost,
        balanceAfter: updatedWallet.balance,
        description: `${millions}M AI token credits`,
        metadata: { tokensAdded, pricePerMillion: opts.pricePerMillion },
      },
    });
    const company = await tx.company.update({
      where: { id: opts.companyId },
      data: { tokenBalance: { increment: tokensAdded } },
      select: { tokenBalance: true },
    });
    return {
      ok: true,
      balance: updatedWallet.balance.toNumber(),
      tokensAdded,
      tokenBalance: company.tokenBalance,
    };
  });
}
