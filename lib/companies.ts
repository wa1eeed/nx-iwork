import { Prisma, type PlanTier } from '@prisma/client';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { isReservedSlug } from '@/lib/reserved-slugs';
import { impersonatedCompanyId } from '@/lib/impersonation';
import { isAllowlistedSuperAdmin } from '@/lib/admin-allowlist';

const SLUG_MAX_LENGTH = 40;
const SLUG_FALLBACK = 'company';

// ASCII-safe slug. Strips Arabic and other non-Latin characters because the
// slug becomes a public URL segment (nx.sa/{slug}). When the input is fully
// non-ASCII (common for Arabic-only names), we return SLUG_FALLBACK and let the
// uniqueness loop append a numeric suffix.
export function slugify(input: string): string {
  const cleaned = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : SLUG_FALLBACK;
}

async function findUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // Cap iterations defensively; collision storms here would indicate abuse.
  while (suffix < 1000) {
    const taken =
      isReservedSlug(candidate) ||
      (await db.company.findUnique({ where: { slug: candidate }, select: { id: true } })) !== null;
    if (!taken) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`.slice(0, SLUG_MAX_LENGTH);
  }
  throw new Error('Could not allocate unique slug');
}

export type CreateCompanyInput = {
  userId: string;
  name: string;
  nameEn?: string | null;
  industry?: string | null;
  teamSize?: string | null;
  mainGoal?: string | null;
  vision?: string | null;
  preferredSlug?: string | null;
  plan?: PlanTier | null;
  preferredLanguage?: 'en' | 'ar' | null;
};

export async function createCompanyForUser(input: CreateCompanyInput) {
  const baseSlug = slugify(input.preferredSlug || input.nameEn || input.name);
  const slug = await findUniqueSlug(baseSlug);

  // Order enabled languages so the chosen one is primary on the public site.
  const lang = input.preferredLanguage ?? 'en';
  const enabledLanguages = lang === 'ar' ? ['ar', 'en'] : ['en', 'ar'];

  return db.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.name,
        nameEn: input.nameEn || null,
        slug,
        industry: input.industry || null,
        teamSize: input.teamSize || null,
        mainGoal: input.mainGoal || null,
        vision: input.vision || null,
        plan: input.plan ?? 'STARTER',
        settings: { create: { primaryLanguage: lang, enabledLanguages } },
        websiteConfig: { create: {} },
        apiSettings: { create: {} },
      },
      select: { id: true, slug: true, name: true },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: {
        companyId: company.id,
        role: 'BUSINESS_OWNER',
      },
    });

    return company;
  });
}

// Used by layouts/server actions to assert the user belongs to a company. The
// session token's companyId can lag behind reality (e.g. immediately after
// onboarding), so we read from DB on each call.
//
// SUPER_ADMIN impersonation: when a valid signed impersonation cookie is
// present AND the caller's DB role is SUPER_ADMIN, every tenant-scoped surface
// resolves to the impersonated company — one choke point, no per-page changes.
// Normal accounts ignore the cookie entirely.
export async function getUserCompany(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { companyId: true, role: true },
  });
  if (!user) return null;
  if (user.role === 'SUPER_ADMIN') {
    const impersonated = await impersonatedCompanyId();
    if (impersonated) return impersonated;
  }
  return user.companyId ?? null;
}

// Resolve the acting company for a dashboard page, or redirect the SAME way the
// dashboard layout does. Critically: a company-less caller who is a SUPER_ADMIN
// (by DB role OR email allowlist) goes to /admin — NOT /onboarding. Page guards
// that hardcoded redirect('/onboarding') were racing the layout and sometimes
// flashed the new-account wizard at an admin (esp. while impersonating, since a
// raw user.companyId lookup is blind to the impersonation cookie). Use this in
// every dashboard page that needs the companyId so the behavior is consistent.
export async function dashboardCompanyIdOrRedirect(session: {
  user?: { id?: string | null; role?: string | null; email?: string | null } | null;
} | null): Promise<string> {
  const userId = session?.user?.id;
  if (!userId) redirect('/login');
  const companyId = await getUserCompany(userId);
  if (companyId) return companyId;
  const isSuperAdmin =
    session?.user?.role === 'SUPER_ADMIN' || isAllowlistedSuperAdmin(session?.user?.email);
  redirect(isSuperAdmin ? '/admin' : '/onboarding');
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
