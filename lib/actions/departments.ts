'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { departmentSchema, type DepartmentInput } from '@/lib/validators/departments';

export type DepartmentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'not_found' | 'has_agents' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

export async function createDepartment(raw: DepartmentInput): Promise<DepartmentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = departmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  try {
    const dept = await db.department.create({
      data: {
        companyId: cid,
        name: parsed.data.name,
        nameEn: parsed.data.nameEn || null,
        icon: parsed.data.icon,
        color: parsed.data.color,
        description: parsed.data.description || null,
      },
      select: { id: true },
    });
    revalidatePath('/departments');
    revalidatePath('/agents');
    return { ok: true, id: dept.id };
  } catch (err) {
    console.error('createDepartment failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function updateDepartment(
  id: string,
  raw: DepartmentInput
): Promise<DepartmentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = departmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  try {
    const res = await db.department.updateMany({
      where: { id, companyId: cid },
      data: {
        name: parsed.data.name,
        nameEn: parsed.data.nameEn || null,
        icon: parsed.data.icon,
        color: parsed.data.color,
        description: parsed.data.description || null,
      },
    });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/departments');
    revalidatePath('/agents');
    return { ok: true, id };
  } catch (err) {
    console.error('updateDepartment failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteDepartment(id: string): Promise<DepartmentActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };

  // Agent.departmentId is Restrict on delete — block (with a clear reason)
  // rather than letting the DB throw, so the UI can tell the owner to move or
  // remove the agents first.
  const agentCount = await db.agent.count({ where: { departmentId: id, companyId: cid } });
  if (agentCount > 0) return { ok: false, error: 'has_agents' };

  try {
    const res = await db.department.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    revalidatePath('/departments');
    return { ok: true, id };
  } catch (err) {
    console.error('deleteDepartment failed', err);
    return { ok: false, error: 'generic' };
  }
}
