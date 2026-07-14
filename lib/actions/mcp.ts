'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { encrypt } from '@/lib/encryption';
import { mcpKey } from '@/lib/mcp/registry';
import { mcpListTools } from '@/lib/mcp/client';

type Result = { ok: true; id?: string } | { ok: false; error: string };

async function companyId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ? getUserCompany(session.user.id) : null;
}

function validUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function uniqueKey(cid: string, name: string): Promise<string> {
  const base = mcpKey(name);
  const taken = new Set((await db.mcpServer.findMany({ where: { companyId: cid }, select: { key: true } })).map((s) => s.key));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
  return `${base}_${Date.now()}`;
}

export interface McpServerInput {
  name: string;
  url: string;
  authToken?: string | null;
}

export async function addMcpServer(input: McpServerInput): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const name = input.name?.trim();
  const url = input.url?.trim();
  if (!name) return { ok: false, error: 'name_required' };
  if (!url || !validUrl(url)) return { ok: false, error: 'bad_url' };

  const created = await db.mcpServer.create({
    data: {
      companyId: cid,
      name,
      key: await uniqueKey(cid, name),
      url,
      authToken: input.authToken?.trim() ? encrypt(input.authToken.trim()) : null,
    },
    select: { id: true },
  });
  revalidatePath('/integrations');
  return { ok: true, id: created.id };
}

export async function toggleMcpServer(id: string, isActive: boolean): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const server = await db.mcpServer.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!server) return { ok: false, error: 'not_found' };
  await db.mcpServer.update({ where: { id }, data: { isActive } });
  revalidatePath('/integrations');
  return { ok: true };
}

export async function removeMcpServer(id: string): Promise<Result> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const server = await db.mcpServer.findFirst({ where: { id, companyId: cid }, select: { id: true } });
  if (!server) return { ok: false, error: 'not_found' };
  await db.mcpServer.delete({ where: { id } });
  revalidatePath('/integrations');
  return { ok: true };
}

// Live connectivity check: list the server's tools so the owner can confirm it
// works before/after saving. Accepts a raw URL+token (pre-save) or an existing id.
export async function testMcpServer(input: {
  url: string;
  authToken?: string | null;
}): Promise<{ ok: true; tools: { name: string; description: string }[] } | { ok: false; error: string }> {
  const cid = await companyId();
  if (!cid) return { ok: false, error: 'unauthorized' };
  const url = input.url?.trim();
  if (!url || !validUrl(url)) return { ok: false, error: 'bad_url' };
  const res = await mcpListTools(url, input.authToken?.trim() || undefined);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, tools: res.tools.map((t) => ({ name: t.name, description: t.description })) };
}
