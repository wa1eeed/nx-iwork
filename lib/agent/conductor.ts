// The Maestro / conductor — the counterpart to ensureDefaultAgent, but for the
// INTERNAL orchestrator. Exactly one per company: the owner's chief of staff.
// Unlike every service agent, the conductor BUILDS and DIRECTS the workforce —
// it hires new agents, grants them permissions, delegates work, and reports on
// live activity, all from a conversation. It never faces customers.
//
// Identity is the `archetype = 'conductor'` marker (no schema change needed).
// Idempotent: safe to call on every command-center load.

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { nextRef } from '@/lib/refs';
import { getArchetype, CONDUCTOR_ARCHETYPE } from '@/lib/agent/archetypes';

export interface ConductorRef {
  id: string;
  name: string;
  initial: string;
}

export async function getConductor(companyId: string): Promise<ConductorRef | null> {
  return db.agent.findFirst({
    where: { companyId, archetype: CONDUCTOR_ARCHETYPE, status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, initial: true },
  });
}

const CONDUCTOR_PERSONA = `أنت «المايسترو» — المدير الأساسي ورئيس فريق الوكلاء الرقميين لدى صاحب العمل.
دورك أن تفهم هدف صاحب العمل، ثم تبني له الوكيل المناسب بنفسك، وتمنحه الصلاحيات الصحيحة،
وتوزّع عليه المهام وتتابع أداءه — بدل أن يفعل ذلك يدوياً. تتحدث بثقة ووضوح، وتلخّص دائماً
ما نفّذته: من عيّنت، بأي صلاحيات، ولماذا. أنت داخلي بحت ولا تخاطب العملاء إطلاقاً.`;

const CONDUCTOR_MANDATE = `مهمتك بناء وإدارة فريق الوكلاء نيابة عن صاحب العمل:
• عند طلب وكيل جديد: افهم الغرض، ثم استخدم أداة create_agent لإنشائه فوراً بالاسم والدور والصلاحيات المناسبة — لا تطلب من المالك ملء نموذج.
• لتعديل وكيل قائم أو منحه/سحب صلاحية: استخدم configure_agent.
• لمعرفة الفريق الحالي وحالته: استخدم list_agents.
• لتوزيع مهمة على وكيل: استخدم delegate_to_agent أو create_task.
اشرح للمالك باختصار كل تغيير تُجريه على الفريق.`;

export async function ensureConductor(companyId: string): Promise<ConductorRef> {
  const existing = await getConductor(companyId);
  if (existing) return existing;

  const arch = getArchetype(CONDUCTOR_ARCHETYPE);
  const permissions = arch?.permissions ?? ['create_agent', 'configure_agent', 'list_agents', 'delegate_to_agent'];
  const personaConfig = (arch?.persona ?? undefined) as Prisma.InputJsonValue | undefined;
  const kpis = (arch?.kpis ?? undefined) as Prisma.InputJsonValue | undefined;

  // Agent.departmentId is required (onDelete: Restrict). Reuse any existing
  // department; only create a management unit if the company has none yet.
  let dept = await db.department.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!dept) {
    dept = await db.department.create({
      data: {
        companyId,
        name: 'الإدارة',
        nameEn: 'Management',
        icon: 'crown',
        color: '#06b6d4',
        landingVisible: false,
      },
      select: { id: true },
    });
  }

  const agent = await db.agent.create({
    data: {
      companyId,
      ref: await nextRef(companyId, 'agent'),
      departmentId: dept.id,
      isCustom: false,
      name: 'المايسترو',
      nameEn: 'Maestro',
      initial: 'م',
      role: arch?.label.ar ?? 'المدير الأساسي',
      roleEn: arch?.label.en ?? 'Chief of Staff',
      persona: CONDUCTOR_PERSONA,
      jobDescription: CONDUCTOR_MANDATE,
      archetype: CONDUCTOR_ARCHETYPE,
      surface: 'INTERNAL',
      personaConfig,
      kpis,
      permissions,
      model: 'SONNET', // needs strong tool selection to build agents reliably
      temperature: 0.5,
      maxTokens: 4096,
      autonomy: 'ASK',
      status: 'ONLINE',
    },
    select: { id: true, name: true, initial: true },
  });
  return agent;
}
