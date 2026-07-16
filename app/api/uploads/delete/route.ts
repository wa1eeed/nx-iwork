import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { deleteTenantFile } from '@/lib/storage/quota';

const schema = z.object({ url: z.string().url().max(2048) });

// Deletes a tenant's uploaded object: removes it from R2 and frees the exact
// bytes from the tenant's storage counter (via the File registry). Tenant-scoped.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  // Impersonation-aware tenant resolution (single choke point in lib/companies).
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'validation' }, { status: 400 });
  }

  const file = await db.file.findFirst({
    where: { companyId: companyId, url: parsed.data.url },
    select: { key: true },
  });
  // Not tracked (legacy / other flow) — nothing to free; report success so the
  // UI can drop the reference.
  if (!file) return NextResponse.json({ ok: true, freed: false });

  const res = await deleteTenantFile(companyId, file.key);
  return NextResponse.json({ ok: res.ok, freed: res.ok });
}
