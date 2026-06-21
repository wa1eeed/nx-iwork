// Super-admin (platform owner) access control. The SUPER_ADMIN role is carried
// in the session (see lib/auth.ts), so guarding is a cheap session check — no DB
// round-trip. Used by the /admin layout and every admin server action.

import { auth } from '@/lib/auth';

export type SuperAdmin = { ok: true; userId: string } | { ok: false };

export async function requireSuperAdmin(): Promise<SuperAdmin> {
  const session = await auth();
  if (session?.user?.id && session.user.role === 'SUPER_ADMIN') {
    return { ok: true, userId: session.user.id };
  }
  return { ok: false };
}

export async function isSuperAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === 'SUPER_ADMIN';
}
