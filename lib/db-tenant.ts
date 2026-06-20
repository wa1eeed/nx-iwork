// Tenant-pinned database access for RLS enforcement.
//
// Runs `fn` inside a transaction that first pins app.current_tenant_id, so the
// tenant_isolation RLS policy (see 20260620170000_rls_policies) restricts every
// query in the callback to that company. set_config(..., true) is transaction-
// local, so the pin auto-clears at commit — safe with connection pooling.
//
// Adopt incrementally: wrap a tenant operation in withTenant to get DB-enforced
// isolation. Un-wrapped queries keep working (the policy is permissive when no
// tenant is pinned) — they just rely on app-level companyId scoping as before.

import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

type TxClient = Prisma.TransactionClient;

export async function withTenant<T>(
  companyId: string,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${companyId}, true)`;
    return fn(tx);
  });
}
