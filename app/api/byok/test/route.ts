import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { testAnthropicKey } from '@/lib/byok';

// Re-tests an already-stored BYOK key. We keep this as a route handler (not a
// Server Action) because (a) it's a verb-style operation rather than a data
// mutation from a form, and (b) the user may click "Test" repeatedly without
// any field change.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { companyId: true },
  });
  if (!user?.companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 400 });
  }

  const apiSettings = await db.companyApiSettings.findUnique({
    where: { companyId: user.companyId },
    select: { byokApiKey: true },
  });
  if (!apiSettings?.byokApiKey) {
    return NextResponse.json({ ok: false, reason: 'no_key' }, { status: 400 });
  }

  let plaintext: string;
  try {
    plaintext = decrypt(apiSettings.byokApiKey);
  } catch (err) {
    console.error('BYOK decrypt failed', err);
    // Most likely the ENCRYPTION_KEY changed — caller should re-enter the key.
    return NextResponse.json(
      { ok: false, reason: 'decrypt_failed' },
      { status: 500 }
    );
  }

  const result = await testAnthropicKey(plaintext);

  await db.companyApiSettings.update({
    where: { companyId: user.companyId },
    data: {
      byokVerified: result.ok,
      byokLastTest: new Date(),
    },
  });

  if (result.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { ok: false, reason: result.reason, status: result.status },
    { status: 200 } // Surface the error in the body, not the HTTP status.
  );
}
