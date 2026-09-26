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

---

## TD-2 — Agent Intelligence Reliability (QUEUED — explicitly not started)

**What:** A tracked, deferred workstream on agent answer quality/reliability, to be
scheduled after the Phase-0 foundation PRs. Do **not** start it during PR-2 or the
other gateway/enforcement PRs. Covers:
- hallucinated business facts (agents stating figures/policies not backed by tools/data);
- stale agent names (referring to agents/roles that changed or no longer exist);
- Task-vs-Booking confusion (conflating `Task` `APPOINTMENT`/`REMINDER` with `Booking`);
- over-questioning (asking the owner for details the agent can derive via its tools);
- tool-first business queries (answer owner data questions by calling the right tool, not guessing);
- authoritative-data policy (which source is the source of truth per fact class);
- memory hygiene (recall threshold, scope enforcement, provider-independent embeddings — see the memory-hardening note in `docs/PHASE_0_TECHNICAL_DESIGN.md §13`; the vector index already exists, do NOT re-add it).

**Why deferred:** foundations (observability, tenant enforcement, policy, economics,
idempotency) come first; reliability work builds on the gateway + business-state/memory layers.

**Status:** QUEUED. Not scheduled to a PR yet. Do not lose.
