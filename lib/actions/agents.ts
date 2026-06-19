'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import { ensureDefaultAgent } from '@/lib/agent/seed';

export type CreateDefaultAgentResult =
  | { ok: true; agentId: string }
  | { ok: false; error: 'unauthenticated' | 'no_company' | 'generic' };

// Used by the chat empty-state to spin up the company's first AI employee with
// one click. Full per-agent creation (custom persona/department/model) lands
// with the Agents CRUD priority.
export async function createDefaultAgentAction(): Promise<CreateDefaultAgentResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'unauthenticated' };

  const companyId = await getUserCompany(session.user.id);
  if (!companyId) return { ok: false, error: 'no_company' };

  try {
    const agent = await ensureDefaultAgent(companyId);
    revalidatePath('/chat');
    return { ok: true, agentId: agent.id };
  } catch (err) {
    console.error('createDefaultAgentAction failed', err);
    return { ok: false, error: 'generic' };
  }
}
