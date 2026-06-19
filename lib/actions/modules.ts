'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';

const modulesSchema = z.object({
  hasEcommerce: z.boolean(),
  hasServices: z.boolean(),
  hasBookings: z.boolean(),
});

export type ModulesInput = z.infer<typeof modulesSchema>;

export type ModulesResult =
  | { ok: true }
  | { ok: false; error: 'no_company' | 'validation' | 'generic' };

// Toggles which modules the company uses. Drives the sidebar, pages, and the
// tools the agents receive.
export async function updateModules(raw: ModulesInput): Promise<ModulesResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'no_company' };
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) return { ok: false, error: 'no_company' };

  const parsed = modulesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'validation' };

  try {
    await db.company.update({ where: { id: companyId }, data: parsed.data });
    // The sidebar reads modules in the dashboard layout — refresh everything.
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    console.error('updateModules failed', err);
    return { ok: false, error: 'generic' };
  }
}
