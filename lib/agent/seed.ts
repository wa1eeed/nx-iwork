// Bootstraps a company's first AI employee so the chat works end-to-end before
// the full Agents CRUD UI exists. Creates a default department + a Customer
// Service agent if the company has none. Idempotent: safe to call repeatedly.

import { db } from '@/lib/db';

const DEFAULT_PERSONA = `أنت موظف خدمة عملاء ودود ومحترف. تجيب باختصار ووضوح،
وتحرص على راحة العميل. تستخدم معلومات الشركة الرسمية فقط، وإذا لم تجد
الإجابة تعرض تحويل العميل لزميل بشري بدلاً من التخمين.`;

export async function ensureDefaultAgent(companyId: string) {
  const existing = await db.agent.findFirst({
    where: { companyId },
    select: { id: true },
  });
  if (existing) return existing;

  // Agent.departmentId is required (onDelete: Restrict), so a department must
  // exist first. Create both in one transaction.
  return db.$transaction(async (tx) => {
    const dept = await tx.department.create({
      data: {
        companyId,
        name: 'خدمة العملاء',
        nameEn: 'Customer Service',
        icon: 'headphones',
        color: '#06b6d4',
      },
      select: { id: true },
    });

    // Seed the agent ref counter to 1 so later agents continue AGT-002, …
    await tx.refCounter.create({ data: { companyId, entity: 'agent', value: 1 } });

    return tx.agent.create({
      data: {
        companyId,
        ref: 'AGT-001',
        departmentId: dept.id,
        name: 'سُهى',
        nameEn: 'Suha',
        initial: 'س',
        role: 'موظفة خدمة عملاء',
        roleEn: 'Customer Service Agent',
        persona: DEFAULT_PERSONA,
        model: 'HAIKU', // fast & cheap tier — right default for live chat
        temperature: 0.6,
      },
      select: { id: true },
    });
  });
}
