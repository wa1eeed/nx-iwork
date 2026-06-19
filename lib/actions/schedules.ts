'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { scheduleSchema, type ScheduleInput } from '@/lib/validators/schedules';
import { computeNextRun } from '@/lib/agent/schedule-time';

export type ScheduleActionResult =
  | { ok: true; id: string }
  | { ok: false; error: 'no_company' | 'validation' | 'bad_cron' | 'bad_agent' | 'not_found' | 'generic' };

async function companyId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getUserCompany(session.user.id);
}

export async function createSchedule(
  agentId: string,
  raw: ScheduleInput
): Promise<ScheduleActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const d = parsed.data;

  const agent = await db.agent.findFirst({
    where: { id: agentId, companyId: cid },
    select: { id: true },
  });
  if (!agent) return { ok: false, error: 'bad_agent' };

  const nextRunAt = computeNextRun(d.cronExpression, d.timezone);
  if (!nextRunAt) return { ok: false, error: 'bad_cron' };

  try {
    const schedule = await db.agentSchedule.create({
      data: {
        companyId: cid,
        agentId,
        name: d.name,
        description: d.description || null,
        cronExpression: d.cronExpression,
        timezone: d.timezone,
        taskTemplate: d.taskTemplate,
        isActive: d.isActive,
        nextRunAt,
      },
      select: { id: true },
    });
    revalidatePath(`/agents/${agentId}`);
    return { ok: true, id: schedule.id };
  } catch (err) {
    console.error('createSchedule failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function toggleSchedule(
  id: string,
  isActive: boolean
): Promise<ScheduleActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };

  // When re-activating, recompute the next run so a long-paused schedule fires
  // from now, not from a stale past time.
  const schedule = await db.agentSchedule.findFirst({
    where: { id, companyId: cid },
    select: { cronExpression: true, timezone: true, agentId: true },
  });
  if (!schedule) return { ok: false, error: 'not_found' };

  const nextRunAt = isActive
    ? computeNextRun(schedule.cronExpression, schedule.timezone)
    : null;

  try {
    await db.agentSchedule.updateMany({
      where: { id, companyId: cid },
      data: { isActive, ...(isActive && nextRunAt ? { nextRunAt } : {}) },
    });
    revalidatePath(`/agents/${schedule.agentId}`);
    return { ok: true, id };
  } catch (err) {
    console.error('toggleSchedule failed', err);
    return { ok: false, error: 'generic' };
  }
}

export async function deleteSchedule(id: string): Promise<ScheduleActionResult> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'no_company' };
  const schedule = await db.agentSchedule.findFirst({
    where: { id, companyId: cid },
    select: { agentId: true },
  });
  try {
    const res = await db.agentSchedule.deleteMany({ where: { id, companyId: cid } });
    if (res.count === 0) return { ok: false, error: 'not_found' };
    if (schedule) revalidatePath(`/agents/${schedule.agentId}`);
    return { ok: true, id };
  } catch (err) {
    console.error('deleteSchedule failed', err);
    return { ok: false, error: 'generic' };
  }
}
