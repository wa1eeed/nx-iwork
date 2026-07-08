import * as Sentry from '@sentry/nextjs';

// Browser error tracking. No-op unless NEXT_PUBLIC_SENTRY_DSN is set. Kept lean:
// error-only, no Session Replay by default (privacy + bundle size).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

// Lets Sentry tie client-side errors to App Router navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
