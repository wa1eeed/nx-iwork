import type { NextAuthConfig } from 'next-auth';

// Edge-safe config: imported by middleware. Must NOT pull in Node-only deps
// (Prisma, bcryptjs). The full config in lib/auth.ts spreads this and adds
// the Credentials provider + DB-backed authorize callback.
export default {
  pages: {
    signIn: '/login',
  },
  providers: [],
} satisfies NextAuthConfig;
