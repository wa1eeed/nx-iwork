// Bootstrap / reconcile the platform super-admin from environment values.
//
// Both ADMIN_EMAIL and ADMIN_PASSWORD live in env — there is no hidden default
// identity in code, so the admin is fully managed from the host environment.
// Going live: set ADMIN_EMAIL + ADMIN_PASSWORD, deploy/restart — on boot the
// account is created (or its password/role reconciled) as SUPER_ADMIN and you
// sign in normally. Re-runs on every server start. Runs from instrumentation.ts.
//
// SECURITY: the password is stored bcrypt-hashed, never plaintext, and there is
// NO default password OR email — the seed is a no-op until BOTH are set (so a
// fresh deploy never ships a guessable default credential). Keep the values in a
// secrets manager and rotate by editing them. Because env is the source of
// truth, a UI password change on this account is overwritten on the next restart
// — expected for an env-managed bootstrap admin.

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const BCRYPT_ROUNDS = 12; // matches the signup route

export async function seedAdminFromEnv(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  // Opt-in: do nothing unless BOTH are set (admin is managed entirely from env).
  if (!email || !password) {
    // Loud hint for the common half-configured case.
    if (password && !email) {
      console.warn('[seed-admin] ADMIN_PASSWORD is set but ADMIN_EMAIL is missing — set ADMIN_EMAIL to create the admin.');
    }
    return;
  }

  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, password: true },
  });

  if (!existing) {
    await db.user.create({
      data: {
        email,
        name,
        password: await bcrypt.hash(password, BCRYPT_ROUNDS),
        role: 'SUPER_ADMIN',
      },
    });
    console.log(`[seed-admin] created SUPER_ADMIN ${email}`);
    return;
  }

  // Reconcile in place. Only rehash when the password actually changed, so a
  // normal restart doesn't churn the DB.
  const data: { password?: string; role?: 'SUPER_ADMIN' } = {};
  if (!(await bcrypt.compare(password, existing.password))) {
    data.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
  }
  if (existing.role !== 'SUPER_ADMIN') data.role = 'SUPER_ADMIN';

  if (Object.keys(data).length > 0) {
    await db.user.update({ where: { email }, data });
    console.log(`[seed-admin] reconciled ${email} (${Object.keys(data).join(', ')})`);
  }
}
