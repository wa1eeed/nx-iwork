'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma, TriggerEvent } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ensureDefaultAgent } from '@/lib/agent/seed';
import { nextRef } from '@/lib/refs';
import { checkRoleConflict, type ConflictResult } from '@/lib/agent/conflict-check';
import { cognitiveOnboard } from '@/lib/agent/cognitive-onboarding';
import { getTemplate, type IfThenScenario } from '@/lib/agent/templates';
import { agentSchema, type AgentInput } from '@/lib/validators/agents';

export type CreateDefaultAgentResult =
  | { ok: true; agentId: string }
  | { ok: false; error: 'unauthenticated' | 'no_company' | 'generic' };

export type AgentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'bad_department' | 'generic' }
  | { ok: false; error: 'conflict'; conflict: ConflictResult };

// Maps a template's scenario event to a live TriggerEvent. Scenarios whose
// event isn't (yet) a platform event are skipped — kept on the template for
// reference until the event exists.
const SCENARIO_EVENT_MAP: Record<string, TriggerEvent> = {
  new_lead_captured: 'LEAD_CREATED',
  lead_created: 'LEAD_CREATED',
  new_order: 'ORDER_CREATED',
  order_created: 'ORDER_CREATED',
  order_paid: 'ORDER_PAID',
};

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

export async function createAgent(
  raw: AgentInput,
  opts?: { force?: boolean }
): Promise<AgentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = agentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  if (!(await assertRefs(cid, d.departmentId, d.parentId))) {
    return { ok: false, error: 'bad_department' };
  }

  // HR gateway: block a near-exact duplicate role unless the owner overrides.
  if (!opts?.force) {
    const conflict = await checkRoleConflict(cid, {
      role: d.role,
      department: await departmentName(cid, d.departmentId),
    });
    if (conflict.severity === 'block') return { ok: false, error: 'conflict', conflict };
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
        isCustom: true,
        model: d.model,
        temperature: d.temperature,
        maxTokens: d.maxTokens,
        systemPrompt: d.systemPrompt || null,
      },
      select: { id: true },
    });
    // Seed long-term memory with the business context before first use.
    await cognitiveOnboard(agent.id, cid);
    revalidatePath('/agents');
    return { ok: true, id: agent.id };
  } catch (err) {
    console.error('createAgent failed', err);
    return { ok: false, error: 'generic' };
  }
}

// Hybrid creation from a system template: copies the blueprint into a
// tenant-scoped agent, materializes its scenarios as live EventTriggers, runs
// the conflict check, and cognitively onboards it.
export async function createAgentFromTemplate(
  templateType: string,
  departmentId: string,
  opts?: { parentId?: string | null; force?: boolean }
): Promise<AgentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };

  const tpl = await getTemplate(templateType);
  if (!tpl) return { ok: false, error: 'not_found' };

  if (!(await assertRefs(cid, departmentId, opts?.parentId ?? null))) {
    return { ok: false, error: 'bad_department' };
  }

  if (!opts?.force) {
    const conflict = await checkRoleConflict(cid, {
      role: tpl.roleNameEn,
      department: await departmentName(cid, departmentId),
    });
    if (conflict.severity === 'block') return { ok: false, error: 'conflict', conflict };
  }

  // Synthesize the persona prompt from the structured profile + instructions.
  const profile = tpl.personalityProfile as { tone?: string; traits?: string[] } | null;
  const personaParts = [
    profile?.tone ? `Tone: ${profile.tone}.` : '',
    profile?.traits?.length ? `Traits: ${profile.traits.join(', ')}.` : '',
    tpl.coreInstructions,
  ].filter(Boolean);

  try {
    const agent = await db.agent.create({
      data: {
        companyId: cid,
        ref: await nextRef(cid, 'agent'),
        departmentId,
        parentId: opts?.parentId || null,
        templateId: tpl.id,
        isCustom: false,
        name: tpl.roleName,
        nameEn: tpl.roleNameEn,
        initial: initialOf(tpl.roleName),
        role: tpl.roleName,
        roleEn: tpl.roleNameEn,
        persona: personaParts.join(' '),
        kpis: tpl.defaultKpis as Prisma.InputJsonValue,
        model: tpl.model,
        systemPrompt: tpl.coreInstructions,
      },
      select: { id: true },
    });

    // Materialize template scenarios into live event triggers where the event
    // exists on the platform today.
    const scenarios = (tpl.ifThenScenarios as unknown as IfThenScenario[]) ?? [];
    const triggers = scenarios
      .map((s) => ({ event: SCENARIO_EVENT_MAP[s.event], action: s.action }))
      .filter((t): t is { event: TriggerEvent; action: string } => Boolean(t.event));
    if (triggers.length > 0) {
      await db.eventTrigger.createMany({
        data: triggers.map((t) => ({
          companyId: cid,
          agentId: agent.id,
          event: t.event,
          name: `${tpl.roleNameEn}: ${t.event}`,
          taskTemplate: t.action,
          isActive: true,
        })),
      });
    }

    await cognitiveOnboard(agent.id, cid);
    revalidatePath('/agents');
    return { ok: true, id: agent.id };
  } catch (err) {
    console.error('createAgentFromTemplate failed', err);
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
