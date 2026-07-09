'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { runDueSchedules, runDueTasks } from '@/lib/agent/scheduler';

type Result = { ok: true } | { ok: false; error: string };

// Owner-set guardrails over the autonomous workforce. Every field is optional
// so the UI can flip one toggle at a time (optimistic). Tenant-scoped: the
// caller can only ever touch their own company's row.
export interface GuardrailsPatch {
  automationEnabled?: boolean;
  requireApprovalForSensitive?: boolean;
  requireMessageReview?: boolean;
  spendApprovalCapEnabled?: boolean;
  spendApprovalCapSar?: number;
}

export async function updateGuardrails(patch: GuardrailsPatch): Promise<Result> {
  const session = await auth();
  const userId = session?.user?.id;
  const companyId = userId ? await getUserCompany(userId) : null;
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  // Whitelist + coerce — never trust the client with the shape of the write.
  const data: GuardrailsPatch = {};
  if (typeof patch.automationEnabled === 'boolean') data.automationEnabled = patch.automationEnabled;
  if (typeof patch.requireApprovalForSensitive === 'boolean')
    data.requireApprovalForSensitive = patch.requireApprovalForSensitive;
  if (typeof patch.requireMessageReview === 'boolean')
    data.requireMessageReview = patch.requireMessageReview;
  if (typeof patch.spendApprovalCapEnabled === 'boolean')
    data.spendApprovalCapEnabled = patch.spendApprovalCapEnabled;
  if (typeof patch.spendApprovalCapSar === 'number' && Number.isFinite(patch.spendApprovalCapSar)) {
    // Clamp to a sane SAR range so a bad input can't disable the rule silently.
    data.spendApprovalCapSar = Math.min(1_000_000, Math.max(0, Math.round(patch.spendApprovalCapSar)));
  }

  if (Object.keys(data).length === 0) return { ok: false, error: 'no_changes' };

  await db.company.update({ where: { id: companyId }, data });

  // The top-bar Automation pill + Guardrails card both read these.
  revalidatePath('/settings');
  revalidatePath('/overview');
  return { ok: true };
}

// Owner-triggered "run automation now" — runs this tenant's due schedules +
// pending autonomous tasks immediately, instead of waiting for the minute cron.
// Lets the owner *see* the workforce act on demand (great for demos / testing).
// Respects the master switch and is bounded so one click can't run away.
export async function runAutomationNow(): Promise<
  { ok: true; ran: number; due: number } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  const companyId = userId ? await getUserCompany(userId) : null;
  if (!companyId) return { ok: false, error: 'unauthenticated' };

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { automationEnabled: true },
  });
  if (!company?.automationEnabled) return { ok: false, error: 'automation_paused' };

  const now = new Date();
  const [sched, tasks] = await Promise.all([
    runDueSchedules(now, companyId),
    runDueTasks(now, 5, companyId), // bounded per click
  ]);

  revalidatePath('/overview');
  revalidatePath('/settings');
  return { ok: true, ran: sched.ran + tasks.ran, due: sched.due + tasks.due };
}
