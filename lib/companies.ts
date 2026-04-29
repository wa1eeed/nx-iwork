import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

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
    const existing = await db.company.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
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
};

export async function createCompanyForUser(input: CreateCompanyInput) {
  const baseSlug = slugify(input.preferredSlug || input.nameEn || input.name);
  const slug = await findUniqueSlug(baseSlug);

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
        settings: { create: {} },
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
export async function getUserCompany(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  return user?.companyId ?? null;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
