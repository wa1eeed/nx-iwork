import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getStorage, companyKey, isStorageConfigured } from '@/lib/storage';
import { reserveAndRecordFile } from '@/lib/storage/quota';

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

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

const bodySchema = z.object({
  contentType: z.string().refine((t) => t in TYPE_EXT, 'unsupported_type'),
  // Where it belongs, for a tidy key prefix (e.g. 'logo', 'products', 'docs').
  purpose: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
  // Client-reported byte size (browsers know it before upload). Recorded in the
  // File registry; not a security control (R2 holds the real bytes).
  size: z.number().int().min(0).max(MAX_SIZE).optional(),
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

  // Sign first — generating a presigned URL has no side effect, so an over-quota
  // request can be rejected after without leaking an upload URL.
  let signed;
  try {
    signed = await getStorage().createUploadUrl({ key, contentType: parsed.data.contentType });
  } catch (err) {
    console.error('Presign upload failed', err);
    return NextResponse.json({ ok: false, reason: 'sign_failed' }, { status: 500 });
  }

  // Atomic quota check + reservation + File registry row. Over quota → 403.
  const reserved = await reserveAndRecordFile({
    companyId: user.companyId,
    key,
    url: signed.publicUrl,
    purpose: parsed.data.purpose,
    mimeType: parsed.data.contentType,
    size: parsed.data.size ?? 0,
    uploadedById: session.user.id,
  });

  if (!reserved.ok) {
    if (reserved.reason === 'quota_exceeded') {
      return NextResponse.json(
        {
          ok: false,
          reason: 'quota_exceeded',
          message: 'Storage quota exceeded for your current plan. Please upgrade your storage ceiling.',
          used: reserved.used,
          limit: reserved.limit,
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...signed });
}
