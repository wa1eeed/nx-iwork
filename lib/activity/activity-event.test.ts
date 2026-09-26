// PR-1 integration test — ActivityEvent dual-write triggers.
//
// Requires a Postgres test DB with the full migration chain applied (incl. the
// 20260926120000_activity_event migration). Point ACTIVITY_TEST_DATABASE_URL at
// it in CI:  prisma migrate deploy && ACTIVITY_TEST_DATABASE_URL=... vitest run
// Without that env var the suite SKIPS (so the default local/CI-without-DB run
// stays green). The trigger behavior is also demonstrated at the SQL level in
// docs/PR_1_ACTIVITY_EVENT_SPEC.md (§ demonstration).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.ACTIVITY_TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run('ActivityEvent dual-write (Postgres triggers)', () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const tag = `pr1_${Date.now()}`;
  let companyA = '';
  let companyB = '';
  let agentId = '';

  beforeAll(async () => {
    const a = await db.company.create({ data: { name: 'A', slug: `${tag}-a` }, select: { id: true } });
    const b = await db.company.create({ data: { name: 'B', slug: `${tag}-b` }, select: { id: true } });
    companyA = a.id;
    companyB = b.id;
    const dept = await db.department.create({ data: { companyId: companyA, name: 'Ops' }, select: { id: true } });
    const agent = await db.agent.create({
      data: { companyId: companyA, departmentId: dept.id, name: 'T', initial: 'T', role: 'tester', persona: 'p' },
      select: { id: true },
    });
    agentId = agent.id;
  });

  afterAll(async () => {
    // Company cascade removes departments/agents/timeline; ActivityEvent is FK-light, prune by tag.
    await db.$executeRawUnsafe(`DELETE FROM "ActivityEvent" WHERE "companyId" IN ($1,$2)`, companyA, companyB);
    await db.company.deleteMany({ where: { id: { in: [companyA, companyB] } } });
    await db.$disconnect();
  });

  it('AuditLog with userId → HUMAN', async () => {
    const row = await db.auditLog.create({ data: { userId: 'user_x', companyId: companyA, action: 'admin.test' } });
    const ev = await db.activityEvent.findUnique({ where: { source_sourceId: { source: 'AUDIT_LOG', sourceId: row.id } } });
    expect(ev?.actorType).toBe('HUMAN');
    expect(ev?.actorId).toBe('user_x');
    expect(ev?.action).toBe('admin.test');
    expect(ev?.companyId).toBe(companyA);
  });

  it('AuditLog without userId → SYSTEM', async () => {
    const row = await db.auditLog.create({ data: { companyId: companyA, action: 'system.test' } });
    const ev = await db.activityEvent.findUnique({ where: { source_sourceId: { source: 'AUDIT_LOG', sourceId: row.id } } });
    expect(ev?.actorType).toBe('SYSTEM');
    expect(ev?.actorId).toBeNull();
  });

  it('TimelineEvent with agentId → AGENT (+ metadata lineage)', async () => {
    const row = await db.timelineEvent.create({
      data: { companyId: companyA, agentId, type: 'AGENT_HANDOFF', title: 'hand', description: 'off', metadata: { taskId: 'task_1' } },
    });
    const ev = await db.activityEvent.findUnique({ where: { source_sourceId: { source: 'TIMELINE', sourceId: row.id } } });
    expect(ev?.actorType).toBe('AGENT');
    expect(ev?.actorId).toBe(agentId);
    expect(ev?.action).toBe('AGENT_HANDOFF');
    expect(ev?.taskId).toBe('task_1'); // best-effort lineage
    expect(ev?.summary).toContain('hand');
  });

  it('TimelineEvent without agentId → SYSTEM', async () => {
    const row = await db.timelineEvent.create({ data: { companyId: companyA, type: 'SYSTEM_ALERT', title: 'sys' } });
    const ev = await db.activityEvent.findUnique({ where: { source_sourceId: { source: 'TIMELINE', sourceId: row.id } } });
    expect(ev?.actorType).toBe('SYSTEM');
    expect(ev?.actorId).toBeNull();
  });

  it('occurredAt preserves the source time; recordedAt is insertion time', async () => {
    const past = new Date('2020-01-01T00:00:00Z');
    const row = await db.timelineEvent.create({ data: { companyId: companyA, agentId, type: 'AGENT_MESSAGE', title: 'old', createdAt: past } });
    const ev = await db.activityEvent.findUnique({ where: { source_sourceId: { source: 'TIMELINE', sourceId: row.id } } });
    expect(ev?.occurredAt.toISOString()).toBe(past.toISOString());
    expect(ev!.recordedAt.getTime()).toBeGreaterThan(past.getTime());
  });

  it('duplicate/backfill projection is idempotent (ON CONFLICT DO NOTHING)', async () => {
    const row = await db.auditLog.create({ data: { userId: 'u', companyId: companyA, action: 'dup.test' } });
    const before = await db.activityEvent.count({ where: { source: 'AUDIT_LOG', sourceId: row.id } });
    // Re-project the same source row (simulates a backfill running while triggers are live).
    await db.$executeRawUnsafe(
      `INSERT INTO "ActivityEvent" ("id","source","sourceId","companyId","actorType","actorId","action","occurredAt")
       SELECT gen_random_uuid()::text,'AUDIT_LOG',"id","companyId",'HUMAN','u',"action","createdAt"
       FROM "AuditLog" WHERE "id"=$1 ON CONFLICT ("source","sourceId") DO NOTHING`,
      row.id,
    );
    const after = await db.activityEvent.count({ where: { source: 'AUDIT_LOG', sourceId: row.id } });
    expect(before).toBe(1);
    expect(after).toBe(1);
  });

  it('FAIL-OPEN: a logging failure does not break the business insert', async () => {
    await db.$executeRawUnsafe(`ALTER TABLE "ActivityEvent" ADD CONSTRAINT pr1_no_boom CHECK ("action" <> 'BOOM')`);
    try {
      const row = await db.auditLog.create({ data: { userId: 'u', companyId: companyA, action: 'BOOM' } });
      // Business row committed…
      const still = await db.auditLog.findUnique({ where: { id: row.id } });
      expect(still).not.toBeNull();
      // …but no ActivityEvent was written (fail-open, warning emitted server-side).
      const ev = await db.activityEvent.count({ where: { source: 'AUDIT_LOG', sourceId: row.id } });
      expect(ev).toBe(0);
    } finally {
      await db.$executeRawUnsafe(`ALTER TABLE "ActivityEvent" DROP CONSTRAINT pr1_no_boom`);
    }
  });

  it('tenant scoping: reads filter by companyId', async () => {
    await db.auditLog.create({ data: { userId: 'u', companyId: companyB, action: 'b.only' } });
    const aRows = await db.activityEvent.findMany({ where: { companyId: companyA, action: 'b.only' } });
    expect(aRows).toHaveLength(0);
  });
});
