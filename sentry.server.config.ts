import * as Sentry from '@sentry/nextjs';

// Server-side (Node runtime) error tracking. No-op unless SENTRY_DSN is set, so
// local dev stays quiet and only staging/production report. Environment is
// tagged from APP_ENV so staging and production are separable in Sentry.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'production',
    // Sample traces in production (cost), everything pre-prod (visibility).
    tracesSampleRate: process.env.APP_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}
