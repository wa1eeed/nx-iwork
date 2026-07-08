// Single source of truth for environment configuration across the three
// deployment targets:
//   - development  → local Mac (next dev)
//   - staging      → VPS / Coolify (pre-live rehearsal)
//   - production   → the live platform
//
// `NODE_ENV` alone can't tell staging from production: a built container runs
// with NODE_ENV=production in BOTH. So `APP_ENV` names the deployment
// explicitly, and everything env-sensitive (payment test/live keys, noindex,
// Sentry environment tag, log verbosity) keys off it — never off NODE_ENV.

export type AppEnv = 'development' | 'staging' | 'production';

function resolveAppEnv(): AppEnv {
  // NEXT_PUBLIC_APP_ENV is inlined on the client; APP_ENV is server-only.
  const raw = (process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? '').toLowerCase();
  if (raw === 'development' || raw === 'staging' || raw === 'production') return raw;
  // Fallback: honour NODE_ENV so an unset APP_ENV still behaves sanely.
  return process.env.NODE_ENV === 'development' ? 'development' : 'production';
}

export const APP_ENV: AppEnv = resolveAppEnv();
export const isDevelopment = APP_ENV === 'development';
export const isStaging = APP_ENV === 'staging';
export const isProduction = APP_ENV === 'production';
/** dev + staging — safe for test payment keys, verbose logs, noindex. */
export const isPreProduction = !isProduction;
/** Only the live production site should be indexable by search engines. */
export const robotsNoindex = !isProduction;

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'NX iWork';

/** Live vs test posture of the Tap payment key, inferred from its prefix. */
export function paymentsMode(): 'off' | 'test' | 'live' {
  const key = process.env.TAP_SECRET_KEY ?? '';
  if (!key) return 'off';
  return key.startsWith('sk_live') ? 'live' : 'test';
}

/**
 * Which optional integrations the running container can see. Booleans only —
 * never the secret values — so it's safe to log and to surface in /api/health.
 */
export function integrationStatus() {
  return {
    database: Boolean(process.env.DATABASE_URL),
    ai: Boolean(process.env.GCP_PROJECT_ID),
    storage: Boolean(process.env.R2_BUCKET && process.env.R2_ENDPOINT),
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    payments: paymentsMode(),
    errorTracking: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
  } as const;
}

/**
 * One-line boot summary + guardrails against the classic multi-env footgun:
 * live payment keys in a non-production env, or test keys in production. Called
 * once from instrumentation.register(). Logs no secret values.
 */
export function logStartupStatus(): void {
  const s = integrationStatus();
  console.info(
    `[env] APP_ENV=${APP_ENV} | db=${on(s.database)} ai=${on(s.ai)} ` +
      `storage=${on(s.storage)} email=${on(s.email)} sms=${on(s.sms)} ` +
      `payments=${s.payments} errors=${on(s.errorTracking)}`,
  );

  if (isProduction && s.payments === 'test') {
    console.warn('[env] ⚠️  PRODUCTION is running with TEST payment keys — real subscriptions will not charge.');
  }
  if (isPreProduction && s.payments === 'live') {
    console.warn(`[env] 🚨 ${APP_ENV.toUpperCase()} is running with LIVE payment keys — real money will move. Use sk_test_… here.`);
  }
  if (isProduction) {
    for (const [k, v] of Object.entries({ database: s.database, ai: s.ai })) {
      if (!v) console.warn(`[env] ⚠️  PRODUCTION is missing a critical integration: ${k}`);
    }
  }
}

function on(v: boolean): string {
  return v ? 'on' : 'off';
}
