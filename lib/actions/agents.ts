'use server';

import { revalidatePath } from 'next/cache';
import type { TriggerEvent } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ensureDefaultAgent } from '@/lib/agent/seed';
import { checkRoleConflict, type ConflictResult } from '@/lib/agent/conflict-check';
import { isTriggerEvent } from '@/lib/agent/events-catalog';
import { hrAgent, HRConflictError, HRValidationError } from '@/lib/agent/hr-agent';
import { agentSchema, type AgentInput } from '@/lib/validators/agents';

export type CreateDefaultAgentResult =
  | { ok: true; agentId: string }
  | { ok: false; error: 'unauthenticated' | 'no_company' | 'generic' };

export type AgentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'bad_department' | 'generic' }
  | { ok: false; error: 'conflict'; conflict: ConflictResult };

async function departmentName(cid: string, departmentId: string): Promise<string> {
  const d = await db.department.findFirst({
    where: { id: departmentId, companyId: cid },
    select: { name: true },
  });
  return d?.name ?? '';
}

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

// Standalone conflict preview for the create form — lets the UI warn before the
// owner commits, without writing anything.
export async function previewConflict(role: string, departmentId: string): Promise<ConflictResult> {
  const cid = await companyId();
  if (!cid || !role.trim()) return { conflict: false, severity: 'none', reason: '' };
  const dept = await departmentName(cid, departmentId);
  return checkRoleConflict(cid, { role: role.trim(), department: dept });
}

// All hiring flows through the HR Agent gateway (the 7-step pipeline). These
// actions are thin adapters that build a DeployPayload and translate the
// service's typed errors into a UI-friendly result.
function fromError(err: unknown): AgentActionResult {
  if (err instanceof HRConflictError) {
    return {
      ok: false,
      error: 'conflict',
      conflict: { conflict: true, severity: 'block', reason: err.verdict.reason ?? '' },
    };
  }
  if (err instanceof HRValidationError) {
    if (err.code === 'no_template') return { ok: false, error: 'not_found' };
    if (err.code === 'bad_department') return { ok: false, error: 'bad_department' };
    return { ok: false, error: 'validation' };
  }
  console.error('agent deploy failed', err);
  return { ok: false, error: 'generic' };
}

export async function createAgent(
  raw: AgentInput,
  opts?: { force?: boolean; scenarios?: { event: string; action: string }[] }
): Promise<AgentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = agentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  // Keep only well-formed scenarios with a known event.
  const scenarios = (opts?.scenarios ?? [])
    .filter((s) => isTriggerEvent(s.event) && s.action.trim())
    .map((s) => ({ event: s.event as TriggerEvent, action: s.action.trim() }));

  try {
    const id = await hrAgent.onboardAndDeployAgent(cid, {
      source: 'custom',
      departmentId: d.departmentId,
      parentId: d.parentId || null,
      name: d.name,
      nameEn: d.nameEn || null,
      role: d.role,
      roleEn: d.roleEn || null,
      persona: d.persona,
      model: d.model,
      temperature: d.temperature,
      systemPrompt: d.systemPrompt || null,
      scenarios,
      permissions: d.permissions ?? [],
      force: opts?.force,
    });
    revalidatePath('/agents');
    return { ok: true, id };
  } catch (err) {
    return fromError(err);
  }
}

// Hybrid creation from a system template — same HR pipeline, template source.
export async function createAgentFromTemplate(
  templateType: string,
  departmentId: string,
  opts?: { parentId?: string | null; force?: boolean }
): Promise<AgentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };

  try {
    const id = await hrAgent.onboardAndDeployAgent(cid, {
      source: 'template',
      templateType,
      departmentId,
      parentId: opts?.parentId ?? null,
      force: opts?.force,
    });
    revalidatePath('/agents');
    return { ok: true, id };
  } catch (err) {
    return fromError(err);
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
        ...(d.permissions ? { permissions: d.permissions } : {}),
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
