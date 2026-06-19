'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import {
  faqSchema,
  triggerSchema,
  type FaqInput,
  type TriggerInput,
} from '@/lib/validators/knowledge';

export type KnowledgeResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'bad_agent' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

// ---- FAQ ----

export async function createFaq(raw: FaqInput): Promise<KnowledgeResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = faqSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  try {
    const item = await db.faqItem.create({
      data: {
        companyId: cid,
        question: parsed.data.question,
        answer: parsed.data.answer,
        category: parsed.data.category || null,
        isActive: parsed.data.isActive,
      },
      select: { id: true },
    });
    revalidatePath('/knowledge');
    return { ok: true, id: item.id };
  } catch (err) {
    console.error('createFaq failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateFaq(id: string, raw: FaqInput): Promise<KnowledgeResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = faqSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  try {
    const res = await db.faqItem.updateMany({
      where: { id, companyId: cid },
      data: {
        question: parsed.data.question,
        answer: parsed.data.answer,
        category: parsed.data.category || null,
        isActive: parsed.data.isActive,
      },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/knowledge');
    return { ok: true, id };
  } catch (err) {
    console.error('updateFaq failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteFaq(id: string): Promise<KnowledgeResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.faqItem.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/knowledge');
    return { ok: true, id };
  } catch (err) {
    console.error('deleteFaq failed', err);
    return { ok: false, error: 'generic' };
  }
}

// ---- Event triggers ----

export async function createTrigger(raw: TriggerInput): Promise<KnowledgeResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = triggerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const agent = await db.agent.findFirst({
    where: { id: parsed.data.agentId, companyId: cid },
    select: { id: true },
  });
  if (!agent) return { ok: false, error: 'bad_agent' };

  try {
    const trigger = await db.eventTrigger.create({
      data: {
        companyId: cid,
        agentId: parsed.data.agentId,
        event: parsed.data.event,
        name: parsed.data.name,
        taskTemplate: parsed.data.taskTemplate,
        isActive: parsed.data.isActive,
      },
      select: { id: true },
    });
    revalidatePath('/knowledge');
    return { ok: true, id: trigger.id };
  } catch (err) {
    console.error('createTrigger failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function toggleTrigger(id: string, isActive: boolean): Promise<KnowledgeResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.eventTrigger.updateMany({
      where: { id, companyId: cid },
      data: { isActive },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/knowledge');
    return { ok: true, id };
  } catch (err) {
    console.error('toggleTrigger failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteTrigger(id: string): Promise<KnowledgeResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.eventTrigger.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/knowledge');
    return { ok: true, id };
  } catch (err) {
    console.error('deleteTrigger failed', err);
    return { ok: false, error: 'generic' };
  }
}
