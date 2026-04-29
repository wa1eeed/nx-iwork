import NextAuth from 'next-auth';
import authConfig from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ['/login', '/signup'];
const PROTECTED_PREFIXES = [
  '/overview',
  '/agents',
  '/departments',
  '/tasks',
  '/chat',
  '/orders',
  '/services',
  '/products',
  '/settings',
  '/admin',
  '/onboarding',
];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  if (AUTH_PAGES.includes(path) && isLoggedIn) {
    return Response.redirect(new URL('/overview', req.nextUrl));
  }

  if (
    PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
    !isLoggedIn
  ) {
    const url = new URL('/login', req.nextUrl);
    if (path !== '/') url.searchParams.set('callbackUrl', path);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
