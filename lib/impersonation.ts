// Super-admin impersonation — lets the platform owner browse a tenant's
// dashboard WITHOUT credentials. Design: a short-lived, HMAC-signed cookie
// holding the target companyId. It only ever takes effect for a session whose
// DB role is SUPER_ADMIN (checked at resolution time in getUserCompany), so a
// stolen/forged cookie is useless on a normal account, and no NextAuth session
// mutation or password handling is involved.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const IMPERSONATION_COOKIE = 'nx_impersonate';
const MAX_AGE_S = 4 * 60 * 60; // 4h — long enough to browse, short enough to forget safely

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET missing — impersonation disabled');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

// value = companyId.expiresAtMs.signature
export function makeImpersonationValue(companyId: string): string {
  const exp = Date.now() + MAX_AGE_S * 1000;
  const payload = `${companyId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function parseImpersonationValue(value: string | undefined): string | null {
  if (!value) return null;
  const i = value.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null; // no secret configured
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const j = payload.lastIndexOf('.');
  if (j <= 0) return null;
  const companyId = payload.slice(0, j);
  const exp = Number(payload.slice(j + 1));
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return companyId || null;
}

export async function setImpersonationCookie(companyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(IMPERSONATION_COOKIE, makeImpersonationValue(companyId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_S,
    path: '/',
  });
}

export async function clearImpersonationCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(IMPERSONATION_COOKIE);
}

// The companyId being impersonated in THIS request, if the cookie is valid.
// Role gating happens at the caller (getUserCompany) — this only validates
// integrity + expiry.
export async function impersonatedCompanyId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return parseImpersonationValue(jar.get(IMPERSONATION_COOKIE)?.value);
  } catch {
    // cookies() unavailable in this context (e.g. plain scripts) → no impersonation.
    return null;
  }
}
