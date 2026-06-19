'use server';

import { revalidatePath } from 'next/cache';
import type { TaskStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { taskSchema, type TaskInput } from '@/lib/validators/tasks';

export type TaskActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'bad_agent' | 'bad_date' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

export async function createTask(raw: TaskInput): Promise<TaskActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = taskSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  // The assigned agent must belong to this company.
  const agent = await db.agent.findFirst({
    where: { id: d.agentId, companyId: cid },
    select: { id: true },
  });
  if (!agent) return { ok: false, error: 'bad_agent' };

  let dueAt: Date | undefined;
  if (d.dueAt) {
    const parsedDate = new Date(d.dueAt);
    if (Number.isNaN(parsedDate.getTime())) return { ok: false, error: 'bad_date' };
    dueAt = parsedDate;
  }

  try {
    const task = await db.task.create({
      data: {
        companyId: cid,
        agentId: d.agentId,
        kind: d.kind,
        title: d.title,
        description: d.description || d.title,
        priority: d.priority,
        triggerType: 'TASK_ASSIGNMENT',
        dueAt,
      },
      select: { id: true },
    });
    revalidatePath('/tasks');
    return { ok: true, id: task.id };
  } catch (err) {
    console.error('createTask failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function setTaskStatus(
  id: string,
  status: TaskStatus
): Promise<TaskActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.task.updateMany({
      where: { id, companyId: cid },
      data: { status },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/tasks');
    return { ok: true, id };
  } catch (err) {
    console.error('setTaskStatus failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteTask(id: string): Promise<TaskActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  try {
    const res = await db.task.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/tasks');
    return { ok: true, id };
  } catch (err) {
    console.error('deleteTask failed', err);
    return { ok: false, error: 'generic' };
  }
}
