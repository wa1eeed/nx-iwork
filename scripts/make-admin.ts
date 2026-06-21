// Promote an existing user to SUPER_ADMIN (platform owner → access to /admin).
//
//   npx tsx scripts/make-admin.ts you@example.com
//
// Run wherever DATABASE_URL points at the target DB. The user keeps their own
// password — only the role changes. (On the live server you can instead run the
// SQL: UPDATE "User" SET role='SUPER_ADMIN' WHERE email='you@example.com';)

import { db } from '@/lib/db';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npx tsx scripts/make-admin.ts <email>');
    process.exit(1);
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) {
    console.error(`❌ No user found with email "${email}". Sign up first, then run this.`);
    process.exit(1);
  }

  await db.user.update({ where: { email }, data: { role: 'SUPER_ADMIN' } });
  console.log(`✅ "${email}" is now SUPER_ADMIN. Open /admin and sign in with that account.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
