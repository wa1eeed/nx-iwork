import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getStorage, companyKey, isStorageConfigured } from '@/lib/storage';

// Allowed upload types → file extension. Kept tight on purpose: logos and
// product images, plus PDF for document uploads. SVG is excluded (script-in-SVG
// risk). Size is bounded by the client + bucket policy; a presigned-POST
// content-length-range can harden this later.
const TYPE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const bodySchema = z.object({
  contentType: z.string().refine((t) => t in TYPE_EXT, 'unsupported_type'),
  // Where it belongs, for a tidy key prefix (e.g. 'logo', 'products', 'docs').
  purpose: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
});

// Returns a presigned PUT URL so the client uploads the file directly to R2.
// The app never proxies the bytes — keeps storage off the VPS.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ ok: false, reason: 'storage_not_configured' }, { status: 503 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });
  if (!user?.companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, reason: parsed.error.issues[0]?.message ?? 'validation' },
      { status: 400 }
    );
  }

  const ext = TYPE_EXT[parsed.data.contentType];
  const key = companyKey(user.companyId, parsed.data.purpose, `${randomUUID()}.${ext}`);

  try {
    const signed = await getStorage().createUploadUrl({
      key,
      contentType: parsed.data.contentType,
    });
    return NextResponse.json({ ok: true, ...signed });
  } catch (err) {
    console.error('Presign upload failed', err);
    return NextResponse.json({ ok: false, reason: 'sign_failed' }, { status: 500 });
  }
}
