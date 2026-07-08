import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const baseConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'bcryptjs', '@google-cloud/vertexai'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  // CDN-friendly headers. Behind Cloudflare these let the edge cache hashed
  // static assets aggressively while leaving dynamic SSR pages uncached.
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ];
  },
};

// next-intl@3's plugin writes its Turbopack alias under `experimental.turbo`,
// which Next.js 16 no longer accepts (it lives at top-level `turbopack`).
// Promote the keys so `next-intl/config` resolves correctly under Turbopack.
const withIntl = withNextIntl(baseConfig) as NextConfig & {
  experimental?: { turbo?: NextConfig['turbopack'] } & NextConfig['experimental'];
};
const turboFromExperimental = withIntl.experimental?.turbo;
if (turboFromExperimental) {
  withIntl.turbopack = { ...(withIntl.turbopack ?? {}), ...turboFromExperimental };
  const { turbo: _turbo, ...restExperimental } = withIntl.experimental ?? {};
  withIntl.experimental = restExperimental;
}

// Sentry wraps the build to instrument the app and (optionally) upload source
// maps. The runtime SDK stays a no-op unless SENTRY_DSN is set; source-map
// upload only runs when SENTRY_AUTH_TOKEN + org/project are configured, so local
// and unconfigured builds are unaffected.
export default withSentryConfig(withIntl, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
