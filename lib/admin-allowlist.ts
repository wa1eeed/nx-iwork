// Optional env allowlist of super-admin emails.
//
// Lets the platform owner grant/revoke admin access by editing one env var
// (`SUPER_ADMIN_EMAILS`, comma-separated) + redeploy — no DB script needed.
//
// SECURITY: only EMAILS belong here, never passwords. The account still signs in
// with its own bcrypt-hashed password; this list only decides *who* is treated
// as SUPER_ADMIN, not *how* they authenticate. It complements the DB role
// (scripts/make-admin.ts) — either path grants admin access.
//
// Kept in its own dependency-free module so both lib/auth.ts (to elevate the
// role at login) and lib/admin.ts (to guard requests) can import it without a
// circular dependency.

export function isAllowlistedSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.SUPER_ADMIN_EMAILS;
  if (!raw) return false;
  const target = email.trim().toLowerCase();
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
