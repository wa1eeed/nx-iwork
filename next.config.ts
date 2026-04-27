import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const baseConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
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

export default withIntl;
