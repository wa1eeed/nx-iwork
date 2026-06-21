// Next.js server-boot hook. Runs once when the server process starts.
export async function register() {
  // Node runtime only — never the edge/middleware bundle (no DB/bcrypt there).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Dynamic import so the seed module (Prisma + bcrypt) is never pulled into the
  // edge bundle. Failures here must never crash the server — just log.
  try {
    const { seedAdminFromEnv } = await import('@/lib/seed-admin');
    await seedAdminFromEnv();
  } catch (err) {
    console.error('[seed-admin] bootstrap failed:', err);
  }
}
