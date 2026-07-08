// HR Agent — the single gateway through which every digital employee is hired.
//
// No agent is ever written to the database directly: each one passes through the
// mandatory lifecycle pipeline below, exactly like a real HR department vetting,
// placing, and onboarding a new hire.
//
//   1. Intake (chat/form/API)        — handled by callers (UI action or /api/hr/deploy)
//   2. Path resolution                — template vs custom (resolvePayload)
//   3. Conflict & redundancy check    — verifyRoleConflict (gemini-2.5-flash, >80% overlap)
//   4. Scenario & tool fine-tuning    — scenarios materialized as EventTriggers
//   5. Hierarchy placement            — direct_manager_id (parentId)
//   6. Cognitive onboarding           — vector memory seeded from the knowledge base
//   7. Activation                     — status ONBOARDING -> ONLINE on the org chart
//
// SDK note: Gemini runs through the official @google-cloud/vertexai provider
// (managed Vertex + ADC), not @google/genai — the production-correct path here.

import type { ClaudeModel, Prisma, TriggerEvent } from '@prisma/client';
import { db } from '@/lib/db';
import { nextRef } from '@/lib/refs';
import { checkRoleConflict } from '@/lib/agent/conflict-check';
import { cognitiveOnboard } from '@/lib/agent/cognitive-onboarding';
import { getTemplate, type IfThenScenario } from '@/lib/agent/templates';
import { agentTokenCap } from '@/lib/plans';

export interface DeployScenario {
  event: TriggerEvent;
  action: string;
}

// Unified hiring request — covers both the template and custom paths.
export interface DeployPayload {
  source: 'template' | 'custom';
  templateType?: string; // required when source === 'template'
  departmentId: string;
  parentId?: string | null; // direct_manager_id
  force?: boolean; // override a blocking conflict
  // Custom fields (ignored for the template path):
  name?: string;
  nameEn?: string | null;
  role?: string;
  roleEn?: string | null;
  persona?: string;
  jobDescription?: string | null; // the "constitution" — mandate + boundaries
  model?: ClaudeModel;
  temperature?: number;
  systemPrompt?: string | null;
  scenarios?: DeployScenario[];
  permissions?: string[]; // explicit allow-list of tool ids (custom path)
}

export interface ConflictVerdict {
  hasConflict: boolean;
  reason: string | null;
}

export class HRConflictError extends Error {
  readonly verdict: ConflictVerdict;
  constructor(verdict: ConflictVerdict) {
    super(verdict.reason ?? 'Role conflict');
    this.name = 'HRConflictError';
    this.verdict = verdict;
  }
}

export class HRValidationError extends Error {
  readonly code: 'no_template' | 'bad_department' | 'invalid_payload';
  constructor(code: 'no_template' | 'bad_department' | 'invalid_payload', message?: string) {
    super(message ?? code);
    this.name = 'HRValidationError';
    this.code = code;
  }
}

const SCENARIO_EVENT_MAP: Record<string, TriggerEvent> = {
  new_lead_captured: 'LEAD_CREATED',
  lead_created: 'LEAD_CREATED',
  new_order: 'ORDER_CREATED',
  order_created: 'ORDER_CREATED',
  order_paid: 'ORDER_PAID',
};

function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? '?';
}

interface ResolvedAgent {
  data: Prisma.AgentUncheckedCreateInput;
  scenarios: DeployScenario[];
  conflictRole: string;
}

export class HRAgentService {
  /**
   * Step 3 — asks gemini-2.5-flash whether the new role overlaps an existing
   * employee by >80% (a near-duplicate). Returns the spec-shaped verdict.
   */
  async verifyRoleConflict(
    companyId: string,
    payload: { role: string; department: string }
  ): Promise<ConflictVerdict> {
    const result = await checkRoleConflict(companyId, payload);
    return {
      hasConflict: result.severity === 'block',
      reason: result.reason || null,
    };
  }

  // Resolves either path into the concrete agent row + scenarios to materialize.
  private async resolvePayload(companyId: string, payload: DeployPayload): Promise<ResolvedAgent> {
    // Step 5 — validate hierarchy placement (department + manager belong to tenant).
    const dept = await db.department.findFirst({
      where: { id: payload.departmentId, companyId },
      select: { id: true, name: true },
    });
    if (!dept) throw new HRValidationError('bad_department');
    if (payload.parentId) {
      const parent = await db.agent.findFirst({
        where: { id: payload.parentId, companyId },
        select: { id: true },
      });
      if (!parent) throw new HRValidationError('bad_department');
    }

    // Per-agent monthly token ceiling, derived from the company's plan.
    const company = await db.company.findUnique({ where: { id: companyId }, select: { plan: true } });
    const tokenLimit = agentTokenCap(company?.plan ?? 'STARTER');

    if (payload.source === 'template') {
      if (!payload.templateType) throw new HRValidationError('invalid_payload');
      const tpl = await getTemplate(payload.templateType);
      if (!tpl) throw new HRValidationError('no_template');

      const profile = tpl.personalityProfile as { tone?: string; traits?: string[] } | null;
      const persona = [
        profile?.tone ? `Tone: ${profile.tone}.` : '',
        profile?.traits?.length ? `Traits: ${profile.traits.join(', ')}.` : '',
        tpl.coreInstructions,
      ]
        .filter(Boolean)
        .join(' ');

      const scenarios = ((tpl.ifThenScenarios as unknown as IfThenScenario[]) ?? [])
        .map((s) => ({ event: SCENARIO_EVENT_MAP[s.event], action: s.action }))
        .filter((s): s is DeployScenario => Boolean(s.event));

      return {
        conflictRole: tpl.roleNameEn,
        scenarios,
        data: {
          companyId,
          departmentId: payload.departmentId,
          parentId: payload.parentId || null,
          templateId: tpl.id,
          isCustom: false,
          name: tpl.roleName,
          nameEn: tpl.roleNameEn,
          initial: initialOf(tpl.roleName),
          role: tpl.roleName,
          roleEn: tpl.roleNameEn,
          persona,
          kpis: tpl.defaultKpis as Prisma.InputJsonValue,
          permissions: ((tpl.defaultPermissions as unknown as string[]) ?? []),
          model: tpl.model,
          systemPrompt: tpl.coreInstructions,
          tokenLimit,
          status: 'ONBOARDING',
        },
      };
    }

    // Custom path.
    if (!payload.name?.trim() || !payload.role?.trim() || !payload.persona?.trim()) {
      throw new HRValidationError('invalid_payload');
    }
    return {
      conflictRole: payload.roleEn || payload.role,
      scenarios: payload.scenarios ?? [],
      data: {
        companyId,
        departmentId: payload.departmentId,
        parentId: payload.parentId || null,
        isCustom: true,
        name: payload.name.trim(),
        nameEn: payload.nameEn || null,
        initial: initialOf(payload.name),
        role: payload.role.trim(),
        roleEn: payload.roleEn || null,
        persona: payload.persona.trim(),
        jobDescription: payload.jobDescription?.trim() || null,
        model: payload.model ?? 'HAIKU',
        temperature: payload.temperature ?? 0.6,
        systemPrompt: payload.systemPrompt || null,
        permissions: payload.permissions ?? [],
        tokenLimit,
        status: 'ONBOARDING',
      },
    };
  }

  /**
   * The full pipeline (steps 3–7). Returns the new agent id, or throws
   * HRConflictError / HRValidationError so callers can surface the reason.
   */
  async onboardAndDeployAgent(companyId: string, payload: DeployPayload): Promise<string> {
    const resolved = await this.resolvePayload(companyId, payload);

    // Step 3 — conflict & redundancy check (skippable via force).
    if (!payload.force) {
      const verdict = await this.verifyRoleConflict(companyId, {
        role: resolved.conflictRole,
        department: payload.departmentId,
      });
      if (verdict.hasConflict) throw new HRConflictError(verdict);
    }

    // Steps 4 + 5 + write — create the employee (ONBOARDING) and its triggers in
    // one transaction. SET LOCAL pins the tenant id for the transaction, the hook
    // Postgres RLS policies will read once enforcement is enabled.
    const agentId = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;

      const agent = await tx.agent.create({
        data: { ...resolved.data, ref: await nextRef(companyId, 'agent') },
        select: { id: true },
      });

      if (resolved.scenarios.length > 0) {
        await tx.eventTrigger.createMany({
          data: resolved.scenarios.map((s) => ({
            companyId,
            agentId: agent.id,
            event: s.event,
            name: `${resolved.conflictRole}: ${s.event}`,
            taskTemplate: s.action,
            isActive: true,
          })),
        });
      }
      return agent.id;
    });

    // Step 6 — cognitive onboarding (network/embedding work, outside the tx).
    await cognitiveOnboard(agentId, companyId);

    // Step 7 — activation: appears on the org chart, ready to serve.
    await db.agent.update({ where: { id: agentId }, data: { status: 'ONLINE' } });

    return agentId;
  }
}

export const hrAgent = new HRAgentService();
