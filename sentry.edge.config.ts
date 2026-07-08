import * as Sentry from '@sentry/nextjs';

// Edge runtime (middleware) error tracking. No-op unless SENTRY_DSN is set.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'production',
    tracesSampleRate: process.env.APP_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}
