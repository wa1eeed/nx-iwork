import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import { getStorage, companyKey, isStorageConfigured } from '@/lib/storage';
import { processImage } from '@/lib/storage/image';
import { reserveAndRecordFile, getStorageStatus } from '@/lib/storage/quota';

export const runtime = 'nodejs'; // sharp needs the Node runtime, not edge.

const MAX_INPUT = 25 * 1024 * 1024; // 25 MB raw input cap (compressed is far smaller)
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']);
const PURPOSE_RE = /^[a-z0-9_-]{1,40}$/;
const QUOTA_MSG = 'Storage quota exceeded for your current plan. Please upgrade your storage ceiling.';

// Compress (sharp → WebP q80, ≤1200px) then store in R2. Unlike the presigned
// /sign route, the bytes pass through the server for the compression pass.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ ok: false, reason: 'storage_not_configured' }, { status: 503 });
  }
  // Impersonation-aware tenant resolution (single choke point in lib/companies).
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_form' }, { status: 400 });
  }
  const file = form.get('file');
  const purpose = String(form.get('purpose') ?? 'uploads');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: 'no_file' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, reason: 'unsupported_type' }, { status: 400 });
  }
  if (!PURPOSE_RE.test(purpose)) {
    return NextResponse.json({ ok: false, reason: 'bad_purpose' }, { status: 400 });
  }
  if (file.size > MAX_INPUT) {
    return NextResponse.json({ ok: false, reason: 'too_large' }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const processed = await processImage(input, file.type);
  const size = processed.buffer.length;

  // Pre-check quota to avoid a wasted upload.
  const status = await getStorageStatus(companyId);
  if (status && status.used + size > status.limit) {
    return NextResponse.json({ ok: false, reason: 'quota_exceeded', message: QUOTA_MSG }, { status: 403 });
  }

  const key = companyKey(companyId, purpose, `${randomUUID()}.${processed.ext}`);

  let url: string;
  try {
    const res = await getStorage().put(key, processed.buffer, processed.contentType);
    url = res.publicUrl;
  } catch (err) {
    console.error('R2 put failed', err);
    return NextResponse.json({ ok: false, reason: 'upload_failed' }, { status: 500 });
  }

  // Atomic reserve + File row. If the final check fails (race) or the DB errors,
  // clean up the object we just wrote so storage never drifts.
  const reserved = await reserveAndRecordFile({
    companyId: companyId,
    key,
    url,
    purpose,
    mimeType: processed.contentType,
    size,
    uploadedById: session.user.id,
  });
  if (!reserved.ok) {
    try {
      await getStorage().delete(key);
    } catch {
      /* best-effort cleanup */
    }
    if (reserved.reason === 'quota_exceeded') {
      return NextResponse.json({ ok: false, reason: 'quota_exceeded', message: QUOTA_MSG }, { status: 403 });
    }
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, publicUrl: url, key, compressed: processed.compressed, size });
}
