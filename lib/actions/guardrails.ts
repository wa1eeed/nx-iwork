'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

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
