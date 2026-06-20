'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ensureDefaultAgent } from '@/lib/agent/seed';
import { nextRef } from '@/lib/refs';
import { agentSchema, type AgentInput } from '@/lib/validators/agents';

export type CreateDefaultAgentResult =
  | { ok: true; agentId: string }
  | { ok: false; error: 'unauthenticated' | 'no_company' | 'generic' };

export type AgentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'bad_department' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

// First grapheme of the name, for the avatar fallback.
function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? '؟';
}

// Confirms a referenced department (and optional manager) belong to this
// company — prevents wiring an agent to another tenant's records.
async function assertRefs(
  cid: string,
  departmentId: string,
  parentId?: string | null
): Promise<boolean> {
  const dept = await db.department.findFirst({
    where: { id: departmentId, companyId: cid },
    select: { id: true },
  });
  if (!dept) return false;
  if (parentId) {
    const parent = await db.agent.findFirst({
      where: { id: parentId, companyId: cid },
      select: { id: true },
    });
    if (!parent) return false;
  }
  return true;
}

export async function createAgent(raw: AgentInput): Promise<AgentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = agentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  if (!(await assertRefs(cid, d.departmentId, d.parentId))) {
    return { ok: false, error: 'bad_department' };
  }

  try {
    const agent = await db.agent.create({
      data: {
        companyId: cid,
        ref: await nextRef(cid, 'agent'),
        departmentId: d.departmentId,
        parentId: d.parentId || null,
        name: d.name,
        nameEn: d.nameEn || null,
        initial: initialOf(d.name),
        role: d.role,
        roleEn: d.roleEn || null,
        persona: d.persona,
        model: d.model,
        temperature: d.temperature,
        maxTokens: d.maxTokens,
        systemPrompt: d.systemPrompt || null,
      },
      select: { id: true },
    });
    revalidatePath('/agents');
    return { ok: true, id: agent.id };
  } catch (err) {
    console.error('createAgent failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateAgent(id: string, raw: AgentInput): Promise<AgentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = agentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  // Guard against an agent being set as its own manager.
  const parentId = d.parentId && d.parentId !== id ? d.parentId : null;
  if (!(await assertRefs(cid, d.departmentId, parentId))) {
    return { ok: false, error: 'bad_department' };
  }

  try {
    const res = await db.agent.updateMany({
      where: { id, companyId: cid },
      data: {
        departmentId: d.departmentId,
        parentId,
        name: d.name,
        nameEn: d.nameEn || null,
        initial: initialOf(d.name),
        role: d.role,
        roleEn: d.roleEn || null,
        persona: d.persona,
        model: d.model,
        temperature: d.temperature,
        maxTokens: d.maxTokens,
        systemPrompt: d.systemPrompt || null,
      },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/agents');
    revalidatePath(`/agents/${id}`);
    return { ok: true, id };
  } catch (err) {
    console.error('updateAgent failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Soft-delete: archive so chat history / tasks stay intact. ARCHIVED agents are
// hidden from the grid and chat list.
export async function archiveAgent(id: string): Promise<AgentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.agent.updateMany({
      where: { id, companyId: cid },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/agents');
    return { ok: true, id };
  } catch (err) {
    console.error('archiveAgent failed', err);
    return { ok: false, error: 'generic' };
  }
}

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
