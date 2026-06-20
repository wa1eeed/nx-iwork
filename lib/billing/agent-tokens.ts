// Per-agent token guard (managed mode). Complements the company-level token bank
// with a monthly per-agent ceiling so a single agent can't drain the shared
// balance. Usage resets at the start of each calendar month (UTC).

import { db } from '@/lib/db';
import { isManagedMode } from '@/lib/billing/tokens';

export type AgentBudgetCheck = { ok: true } | { ok: false; reason: 'agent_limit' };

function isPreviousMonth(date: Date, now: Date): boolean {
  return (
    date.getUTCFullYear() !== now.getUTCFullYear() ||
    date.getUTCMonth() !== now.getUTCMonth()
  );
}

// Checked before a run. Unlimited (cap 0) or a fresh month → ok.
export async function checkAgentBudget(agentId: string): Promise<AgentBudgetCheck> {
  if (!isManagedMode()) return { ok: true };

  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { tokenLimit: true, periodTokensUsed: true, periodStartedAt: true },
  });
  if (!agent || agent.tokenLimit <= 0) return { ok: true };

  // A new month resets the allowance (the actual reset happens on next charge).
  if (isPreviousMonth(agent.periodStartedAt, new Date())) return { ok: true };
  if (agent.periodTokensUsed >= agent.tokenLimit) return { ok: false, reason: 'agent_limit' };
  return { ok: true };
}

// Called after a run to accrue this agent's monthly usage (resets on month roll).
export async function chargeAgentTokens(agentId: string, amount: number): Promise<void> {
  if (!isManagedMode() || amount <= 0) return;
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { periodStartedAt: true },
  });
  if (!agent) return;

  const now = new Date();
  if (isPreviousMonth(agent.periodStartedAt, now)) {
    await db.agent.update({
      where: { id: agentId },
      data: { periodTokensUsed: amount, periodStartedAt: now },
    });
  } else {
    await db.agent.update({
      where: { id: agentId },
      data: { periodTokensUsed: { increment: amount } },
    });
  }
}
