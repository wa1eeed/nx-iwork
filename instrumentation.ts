import * as Sentry from '@sentry/nextjs';

// Next.js server-boot hook. Runs once per server/edge process start.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Error tracking (no-op without SENTRY_DSN).
    await import('./sentry.server.config');

    // One-line env summary + multi-env guardrails (test/live payment keys,
    // missing critical integrations). Never throws.
    try {
      const { logStartupStatus } = await import('@/lib/env');
      logStartupStatus();
    } catch (err) {
      console.error('[env] startup status failed:', err);
    }

    // Seed/reconcile the super-admin from env. Dynamic import keeps Prisma+bcrypt
    // out of the edge bundle. Never crash the server — just log.
    try {
      const { seedAdminFromEnv } = await import('@/lib/seed-admin');
      await seedAdminFromEnv();
    } catch (err) {
      console.error('[seed-admin] bootstrap failed:', err);
    }

    // In-process autonomous engine. No-op unless CRON_SELF=1 — then the app
    // drives its own scheduler on a 60s interval (single-flight via a DB lease),
    // so autonomy runs without an external Coolify Scheduled Task. Dynamic import
    // keeps the scheduler + Prisma out of the edge bundle.
    try {
      const { startSelfCron } = await import('@/lib/cron/self-scheduler');
      startSelfCron();
    } catch (err) {
      console.error('[self-cron] start failed:', err);
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Error tracking on the edge/middleware runtime (no-op without SENTRY_DSN).
    await import('./sentry.edge.config');
  }
}

// Surfaces App Router / RSC server errors to Sentry (no-op without DSN).
export const onRequestError = Sentry.captureRequestError;
