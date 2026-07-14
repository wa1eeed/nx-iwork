'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { TOOL_LABELS } from '@/lib/agent/tool-labels';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function companyId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'skill'
  );
}

async function uniqueKey(cid: string, name: string, excludeId?: string): Promise<string> {
  const base = slug(name);
  const taken = new Set(
    (
      await db.skill.findMany({
        where: { companyId: cid, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { key: true },
      })
    ).map((s) => s.key)
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
  return `${base}_${Date.now()}`;
}

// Keep only tool ids we recognise (built-in catalogue), so a skill can't grant an
// unknown tool. MCP tools are granted separately via the agent's use_mcp permission.
function cleanTools(tools: string[] | undefined): string[] {
  return Array.from(new Set((tools ?? []).filter((t) => TOOL_LABELS[t])));
}

export interface SkillInput {
  name: string;
  description?: string | null;
  instructions?: string | null;
  icon?: string | null;
  tools: string[];
}

export async function createSkill(input: SkillInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'name_required' };
  const description = input.description?.trim() || '—';

  const created = await db.skill.create({
    data: {
      companyId: cid,
      key: await uniqueKey(cid, name),
      name,
      nameEn: name,
      description,
      descriptionEn: description,
      icon: input.icon?.trim() || 'sparkle',
      promptTemplate: input.instructions?.trim() || null,
      tools: cleanTools(input.tools),
    },
    select: { id: true },
  });
  revalidatePath('/skills');
  return { ok: true, id: created.id };
}

export async function updateSkill(id: string, input: SkillInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const existing = await db.skill.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) return { ok: false, error: 'not_found' };
  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'name_required' };
  const description = input.description?.trim() || '—';

  await db.skill.update({
    where: { id },
    data: {
      name,
      nameEn: name,
      description,
      descriptionEn: description,
      icon: input.icon?.trim() || 'sparkle',
      promptTemplate: input.instructions?.trim() || null,
      tools: cleanTools(input.tools),
    },
  });
  revalidatePath('/skills');
  return { ok: true, id };
}

export async function deleteSkill(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const existing = await db.skill.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!existing) return { ok: false, error: 'not_found' };
  await db.skill.delete({ where: { id } });
  revalidatePath('/skills');
  return { ok: true };
}
