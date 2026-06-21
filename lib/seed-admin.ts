// Bootstrap / reconcile the platform super-admin from environment values.
//
// Set ADMIN_EMAIL + ADMIN_PASSWORD (optional ADMIN_NAME) and the account is
// created — or its password/role reconciled — as SUPER_ADMIN on every server
// start. The credentials are therefore fully managed from env: change them and
// redeploy, and they take effect. Runs from instrumentation.ts (server boot).
//
// SECURITY: the password is stored bcrypt-hashed, never plaintext. Keep the env
// value in a secrets manager and rotate by editing it. Because env is the source
// of truth, a UI password change on this specific account is overwritten on the
// next restart — that's expected for an env-managed bootstrap admin.

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const BCRYPT_ROUNDS = 12; // matches the signup route

export async function seedAdminFromEnv(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  // Opt-in: do nothing unless BOTH are provided.
  if (!email || !password) return;

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
