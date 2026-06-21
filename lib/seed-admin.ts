// Bootstrap / reconcile the platform super-admin from environment values.
//
// The admin email defaults to DEFAULT_ADMIN_EMAIL (override with ADMIN_EMAIL),
// so going live is a two-step: deploy, then set ADMIN_PASSWORD in the host env
// and restart — the account is created as SUPER_ADMIN and you sign in normally.
// On every server start the account is created, or its password/role reconciled,
// so the credentials stay fully managed from env. Runs from instrumentation.ts.
//
// SECURITY: the password is stored bcrypt-hashed, never plaintext, and there is
// NO default password — the seed is a no-op until ADMIN_PASSWORD is set (so a
// fresh deploy never ships a guessable default credential). Keep the value in a
// secrets manager and rotate by editing it. Because env is the source of truth,
// a UI password change on this account is overwritten on the next restart —
// expected for an env-managed bootstrap admin.

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const BCRYPT_ROUNDS = 12; // matches the signup route
const DEFAULT_ADMIN_EMAIL = 'waleed@nx.sa';

export async function seedAdminFromEnv(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  // Opt-in on the password: do nothing until ADMIN_PASSWORD is set. The email
  // has a default, so only the password is required to bring the admin online.
  if (!password) return;

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
