import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@prisma/client';
import { db } from '@/lib/db';
import authConfig from '@/lib/auth.config';
import { isAllowlistedSuperAdmin } from '@/lib/admin-allowlist';

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        // Env allowlist can elevate an already-authenticated account to
        // SUPER_ADMIN — editable via env without a DB migration/script. The
        // password check above still gates entry; the allowlist only sets role.
        const role = isAllowlistedSuperAdmin(user.email) ? 'SUPER_ADMIN' : user.role;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role,
          companyId: user.companyId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.companyId = (token.companyId as string | null) ?? null;
      }
      return session;
    },
  },
});
