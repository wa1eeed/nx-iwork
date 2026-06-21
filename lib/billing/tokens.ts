// Managed-mode token bank.
//
// In managed mode the platform pays the AI provider, so each company spends from
// a prepaid `tokenBalance`. We check the balance before a request and decrement
// it after. In BYOK mode these are no-ops (the company's own key is billed
// directly), so callers can invoke them unconditionally.

import { db } from '@/lib/db';

// Managed is the default; BYOK is opt-in (kept aligned with getAiMode in lib/ai).
export function isManagedMode(): boolean {
  return process.env.AI_MODE !== 'byok';
}

export type BudgetCheck = { ok: true } | { ok: false; reason: 'billing_limit' };

// Returns ok unless managed mode is on AND the company is out of credits.
export async function checkTokenBudget(companyId: string): Promise<BudgetCheck> {
  if (!isManagedMode()) return { ok: true };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { tokenBalance: true },
  });
  if (!company || company.tokenBalance <= 0) {
    return { ok: false, reason: 'billing_limit' };
  }
  return { ok: true };
}

// Atomically decrements the balance by the tokens consumed this turn. No-op in
// BYOK mode or for non-positive amounts. The decrement is a single atomic SQL
// UPDATE; the pre-check above can let a turn finish slightly into the negative
// under heavy concurrency, which is acceptable (next request is blocked).
// Returns the remaining balance after the decrement (or null in BYOK/no-op), so
// callers can log the exact deduction.
export async function chargeTokens(companyId: string, amount: number): Promise<number | null> {
  if (!isManagedMode() || amount <= 0) return null;
  const updated = await db.company.update({
    where: { id: companyId },
    data: { tokenBalance: { decrement: amount } },
    select: { tokenBalance: true },
  });
  return updated.tokenBalance;
}
