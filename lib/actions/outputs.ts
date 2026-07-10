'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import type { AgentOutputStatus } from '@prisma/client';

type Result = { ok: true } | { ok: false; error: string };

async function authedCompany(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

const statusSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(['DRAFT', 'READY', 'APPROVED', 'PUBLISHED', 'ARCHIVED']),
});

// Owner review action on a deliverable in the agent workspace. Tenant-scoped via
// updateMany + companyId guard so it can never touch another company's output.
export async function setOutputStatus(input: z.infer<typeof statusSchema>): Promise<Result> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const companyId = await authedCompany();
  if (!companyId) return { ok: false, error: 'unauthorized' };

  const res = await db.agentOutput.updateMany({
    where: { id: parsed.data.id, companyId },
    data: { status: parsed.data.status as AgentOutputStatus },
  });
  if (res.count === 0) return { ok: false, error: 'not_found' };

  revalidatePath('/outputs');
  return { ok: true };
}
