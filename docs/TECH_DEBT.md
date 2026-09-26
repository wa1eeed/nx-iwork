# Technical Debt Register

Tracked, deliberate shortcuts to be corrected in a named later phase. Each entry:
what, where, why deferred, and the correction plan.

---

## TD-1 — `APPROVAL_RESOLVED` actor attribution (introduced with PR-1)

**What:** In the unified `ActivityEvent` log, timeline events of type `APPROVAL_RESOLVED`
are attributed to **AGENT**, even though the real actor is the **human owner** who
approved/rejected the decision.

**Where:** The source writer `db.timelineEvent.create(...)` in
[lib/actions/approvals.ts:50](../lib/actions/approvals.ts) records only the *subject*
`agentId` (the agent whose approval was resolved) — it does not store the resolving
human's id. The PR-1 dual-write trigger `activity_from_timeline()`
([prisma/migrations/20260926120000_activity_event/migration.sql](../prisma/migrations/20260926120000_activity_event/migration.sql))
therefore maps any `TimelineEvent` with a non-null `agentId` to `actorType = AGENT`.
This is correct given the data present in the row; the human actor is simply not in it.

**Why deferred:** PR-1 must not modify existing writers (approved scope). We deliberately
do **not** manufacture HUMAN attribution that isn't in the source row.

**Correction plan:** When the unified approval/execution lineage lands (Phase 0 approval-flow
PR / gateway era), attribute the resolver at the **source** — record the human `resolvedById`
as the actor (HUMAN) and keep the agent as the subject/`entityId`. At that point the
`ActivityEvent` for approval resolutions will read `actorType = HUMAN, actorId = <resolver>,
entityType = 'Agent', entityId = <agentId>`. No backfill of historical rows is required.

**Status:** OPEN. Owner: approval-lineage PR.
