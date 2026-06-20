// Per-tenant human-readable reference codes: CUS-001, PRD-014, AGT-003, …
//
// The real primary key stays a globally-unique cuid. `ref` is a friendly display
// code that never collides because it's namespaced by company + entity and
// allocated from an atomic per-(company,entity) counter — so no matter how many
// tenants or records exist platform-wide, codes never clash.

import { db } from '@/lib/db';

export type RefEntity = 'customer' | 'product' | 'service' | 'booking' | 'agent';

const PREFIX: Record<RefEntity, string> = {
  customer: 'CUS',
  product: 'PRD',
  service: 'SRV',
  booking: 'BKG',
  agent: 'AGT',
};

// Atomically increments the counter (upsert) and returns the next code. Safe
// under concurrency: the row-level increment is atomic.
export async function nextRef(companyId: string, entity: RefEntity): Promise<string> {
  const counter = await db.refCounter.upsert({
    where: { companyId_entity: { companyId, entity } },
    create: { companyId, entity, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return `${PREFIX[entity]}-${String(counter.value).padStart(3, '0')}`;
}
