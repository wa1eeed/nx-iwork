// Super-admin (platform owner) access control. The SUPER_ADMIN role is carried
// in the session (see lib/auth.ts), so guarding is a cheap session check — no DB
// round-trip. Used by the /admin layout and every admin server action.

import type { Session } from 'next-auth';
import { auth } from '@/lib/auth';
import { isAllowlistedSuperAdmin } from '@/lib/admin-allowlist';

export type SuperAdmin = { ok: true; userId: string } | { ok: false };

// A session is super-admin if the DB role is SUPER_ADMIN (scripts/make-admin.ts)
// OR the account's email is in the SUPER_ADMIN_EMAILS env allowlist. The email
// check also covers sessions issued before the env was updated (no re-login).
function sessionIsSuperAdmin(session: Session | null): boolean {
  return (
    session?.user?.role === 'SUPER_ADMIN' ||
    isAllowlistedSuperAdmin(session?.user?.email)
  );
}

export async function requireSuperAdmin(): Promise<SuperAdmin> {
  const session = await auth();
  if (session?.user?.id && sessionIsSuperAdmin(session)) {
    return { ok: true, userId: session.user.id };
  }
  return { ok: false };
}

export async function isSuperAdmin(): Promise<boolean> {
  const session = await auth();
  return sessionIsSuperAdmin(session);
}
