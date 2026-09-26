# PR-1 Implementation Spec — `ActivityEvent` + dual-write

**Status:** SPEC ONLY. No code, no migration executed. Awaiting approval to implement PR-1 (and PR-1 only).
**Scope discipline:** this PR adds an observability spine and starts capturing existing activity into it. It introduces **no** Goal Engine, **no** new agent behavior, **no** EventOutbox, **no** Tool Gateway, **no** enforcement, and **switches no read surface**. It is purely additive.
**Amendments honored:** single `LedgerEntry`/economics is out of scope here; RLS readiness instrumentation is noted as a hook (ActivityEvent will later *measure* tenant-context coverage) but not built here; the **execution-lineage** columns (`goal → task → execution → tool action → effect → ledger/activity/outcome`) are included as nullable fields so later PRs populate them — PR-1 does not build the lineage, it just does not preclude it.

---

## 1. Exact current audit/activity models and writers

**`AuditLog`** (`prisma/schema.prisma:1793`): `userId?`, `companyId?` (both nullable, `onDelete: SetNull`), `action String`, `entityType?`, `entityId?`, `ipAddress?`, `userAgent?`, `metadata? Json`, `createdAt`. Indexes: `userId`, `companyId`, `action`, `createdAt`.
- **Writers — exactly one:** the local helper `audit(userId, action, companyId, metadata)` at `lib/actions/admin.ts:79`, whose body is `db.auditLog.create(...)` at `lib/actions/admin.ts:81`. Used only by super-admin server actions. **AuditLog today = super-admin/human platform actions only.**

**`TimelineEvent`** (`prisma/schema.prisma:1574`): `companyId` (**required**, `onDelete: Cascade`), `agentId?` (`onDelete: SetNull`), `type TimelineEventType`, `title String`, `description? Text`, `metadata? Json`, `createdAt`. Indexes: `[companyId, createdAt]`, `[agentId]`. Enum `TimelineEventType` = TASK_CREATED/STARTED/COMPLETED/FAILED/BLOCKED, AGENT_MESSAGE, AGENT_HANDOFF, DECISION_NEEDED, APPROVAL_REQUESTED, APPROVAL_RESOLVED, MEMORY_SAVED, SYSTEM_ALERT, INTEGRATION_TRIGGERED, AGENT_WOKE, AGENT_SLEPT, OUTPUT_DELIVERED (`schema.prisma:1555-1573`).
- **Writers — 8 inline `db.timelineEvent.create`, no helper:** `lib/agent/scheduler.ts:262` (TASK_BLOCKED), `lib/agent/task.ts:162` (TASK_COMPLETED, **inside the completion `$transaction`**), `lib/agent/task.ts:200` (TASK_FAILED), `lib/agent/tools.ts:1796` (OUTPUT_DELIVERED, create_output), `:1838` (AGENT_MESSAGE, create_agent), `:1900` (AGENT_HANDOFF, delegate_to_agent), `:2093` (record CRUD), `lib/actions/approvals.ts:50` (APPROVAL_RESOLVED). Several run inside transactions — **critical constraint** (see §7/§8).

**Consequence:** there is no single app-level chokepoint for TimelineEvent, and some writes are transactional. An app-level dual-write would touch 8 hot-path sites and risk aborting business transactions if the extra insert fails. This drives the **DB-trigger** approach in §7.

---

## 2. Proposed `ActivityEvent` schema (design — not migrated)

```prisma
enum ActivityActorType { HUMAN AGENT SYSTEM }
enum ActivitySource   { AUDIT_LOG TIMELINE GATEWAY }   // provenance of the row

model ActivityEvent {
  id        String @id @default(cuid())

  // Provenance + idempotent identity for dual-write/backfill dedup
  source    ActivitySource
  sourceId  String?          // originating AuditLog/TimelineEvent id (null for future GATEWAY rows)

  // Tenant (nullable: AuditLog rows may have no company; platform/system events)
  companyId String?
  company   Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)

  // Actor (polymorphic — NO FK on actorId; it may be a userId or agentId)
  actorType ActivityActorType
  actorId   String?          // userId | agentId | null(SYSTEM)

  // What happened
  action    String           // TimelineEventType value, or audit action string, or capability id (later)
  entityType String?
  entityId   String?
  summary    String? @db.Text // human-readable (TimelineEvent.title[/description])

  // Execution lineage (nullable in PR-1; populated by later PRs — do not preclude)
  goalId      String?
  taskId      String?
  executionId String?
  sessionId   String?         // conversation / public-conversation id
  contractId  String?

  // Decision/cost/outcome slots (null in PR-1; gateway/economics fill later)
  decision  String?           // ALLOW | DENY | NEEDS_APPROVAL
  cost      Json?
  outcome   Json?

  // Request context (from AuditLog today)
  ipAddress String?
  userAgent String?
  metadata  Json?

  createdAt DateTime @default(now())  // mirrors the source row's createdAt on dual-write

  @@index([companyId, createdAt])
  @@index([actorType, actorId])
  @@index([entityType, entityId])
  @@index([taskId])
  @@index([executionId])
  @@unique([source, sourceId])        // idempotent dual-write + backfill dedup
}
```
Rationale: `source`+`sourceId`+`@@unique` make the trigger and any later backfill **idempotent** (no double rows). Lineage columns exist now, stay null now. Not over-normalized (single flat table, JSON for open-ended context).

---

## 3. Actor model (HUMAN / AGENT / SYSTEM)

| Source row | actorType | actorId | Rule |
|---|---|---|---|
| `AuditLog` | **HUMAN** | `userId` | AuditLog is written by super-admin server actions → a human actor. If `userId` null → SYSTEM. |
| `TimelineEvent` with `agentId` set | **AGENT** | `agentId` | Agent lifecycle/action event. |
| `TimelineEvent` with `agentId` null | **SYSTEM** | `null` | Scheduler/platform-originated timeline event with no agent. |

`actorId` is deliberately **not** a foreign key (it is polymorphic across `User` and `Agent`). Actor *type* disambiguates it. Later PRs (Tool Gateway) will write `AGENT`/`SYSTEM`/`HUMAN` rows directly with the same convention.

---

## 4. Tenant scoping

- `companyId` is **nullable** to faithfully mirror `AuditLog.companyId?` (platform-level super-admin actions have none). Every `TimelineEvent`-sourced row always carries `companyId` (it's required there).
- **Read rule (for later PRs that consume it):** always filter `where: { companyId }` for tenant surfaces; `companyId IS NULL` rows are platform/system events visible only to super-admin. PR-1 adds no read surface, so this is a documented contract, not code.
- **RLS:** `ActivityEvent` is a **prime candidate for the RLS table set** and for the "tenant-context coverage" instrumentation (RLS-readiness amendment). PR-1 does **not** enable RLS on it; it is added to the RLS/`withTenant` scope in the later tenant-enforcement PRs. Design note recorded so it isn't forgotten.

---

## 5. Correlation / lineage fields

`goalId`, `taskId`, `executionId`, `sessionId`, `contractId` — all nullable. In PR-1:
- Populated **best-effort** only where the source already carries it in `metadata` (e.g. a TimelineEvent whose `metadata` includes a `taskId`). The trigger copies `metadata->>'taskId'` etc. when present; otherwise null.
- **No new correlation is manufactured** in PR-1. The columns exist so the Tool Gateway (PR-2) and later economics/outcome PRs write a single `executionId` lineage: `goal → task → execution → tool action → effect → ledger/activity/outcome`. This satisfies the "do not preclude lineage" requirement without building a workflow engine.

---

## 6. Before/after state & privacy

- PR-1 copies **only what the source rows already contain** (`action`/`title`/`description`/`metadata`/ip/ua). It introduces **no** new capture of request/response bodies, chat content, customer PII, or secrets.
- **Invariant:** an `ActivityEvent` is never *more* exposed than its source — same `companyId` scope, same sensitivity. No secret ever reaches this table (secrets are encrypted at rest elsewhere and are not present in the source rows).
- **Before/after diffs are explicitly deferred** to the Tool Gateway PRs, where they will be captured with a redaction policy. PR-1 leaves `metadata`/`outcome` as open slots but writes only source-derived, non-sensitive content.
- Privacy posture to document: ActivityEvent is internal audit data, owner/super-admin scoped, subject to the retention policy in §11.

---

## 7. Dual-write approach — **Postgres AFTER INSERT triggers** (chosen)

Because TimelineEvent has 8 inline writers (several in transactions) and AuditLog has one, and because *logging must never break a business operation* (§8), PR-1 uses **database triggers**, not app-level writes:

- One shared `plpgsql` function `activity_event_from_source()` that maps the inserted row → an `ActivityEvent` insert, wrapped in `BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END;`. In Postgres this exception handler opens a **subtransaction**: if the mapping/insert fails, only the subtransaction rolls back — **the original business insert is unaffected** (fail-open). On success, the `ActivityEvent` commits atomically with the source row (no orphan, no gap).
- Two triggers: `AFTER INSERT ON "AuditLog"` (→ HUMAN) and `AFTER INSERT ON "TimelineEvent"` (→ AGENT/SYSTEM), each calling the function with a `source` tag. `ON CONFLICT (source, sourceId) DO NOTHING` for idempotence.
- **Zero application code changes to the 9 writer sites** — surgical, no hot-path regression risk, captures all current *and future* writes automatically.

Trigger DDL lives in the migration SQL (Prisma does not generate triggers). This mirrors existing repo practice — the RLS migrations (`prisma/migrations/20260620170000_rls_policies/migration.sql`) are hand-authored raw SQL in a migration file. Flow: `prisma migrate` generates the `CREATE TABLE`/enums/indexes from the schema diff, then we **hand-append** the `CREATE FUNCTION` + two `CREATE TRIGGER` statements to that migration file before applying.

**Alternative considered & rejected for PR-1:** introduce a `recordTimeline()` app helper and route all 8 sites through it. Rejected because (a) it touches agent hot paths (regression surface), (b) the in-transaction writes (`task.ts:162`) make app-level fail-isolation unreliable — a caught JS error still aborts an open Prisma interactive transaction in Postgres. The trigger's plpgsql subtransaction is the correct isolation primitive. (A typed `recordActivity()` helper for *direct* writes will arrive in PR-2 for the Gateway, which is not inside legacy transactions.)

---

## 8. Failure semantics (logging must not break business ops)

- **Fail-open, guaranteed at the DB layer.** The `EXCEPTION WHEN OTHERS THEN NULL` guard means any error inside the trigger (bad mapping, constraint, type issue) is swallowed and the business `INSERT`/transaction proceeds. This is the single most important property of PR-1 and is provable by test (§12b).
- The trigger does **no external I/O** (no network, no cross-table reads beyond the inserted row) — it cannot hang or add meaningful latency; overhead is one local insert (+ a savepoint).
- **Observability:** because dual-write is best-effort, add a lightweight reconciliation check (a scheduled count comparison, or an ad-hoc query) that flags divergence between source-row counts and `ActivityEvent` rows per source. Not a blocking mechanism — an alert only. (Can be a follow-up; not required to land PR-1.)
- There is intentionally **no fail-closed audit path** in PR-1. If a security-critical action later needs guaranteed audit-or-abort, that is an explicit gateway-era decision, not this PR.

---

## 9. Backfill strategy

- **None required for PR-1.** No read surface consumes `ActivityEvent` yet, so historical rows are unnecessary to ship the PR.
- Provide an **optional, idempotent** backfill script (`scripts/backfill-activity.ts`, run manually, *not* in the migration) that copies existing `AuditLog` + `TimelineEvent` rows into `ActivityEvent` using the same mapping, relying on `@@unique([source, sourceId])` + `ON CONFLICT DO NOTHING` so it can run repeatedly and safely alongside live triggers. Runs later, when reads switch. Documented, deferred.

---

## 10. Indexes

Exactly those in §2: `[companyId, createdAt]` (tenant time-range reads), `[actorType, actorId]` (per-actor history), `[entityType, entityId]` (entity audit), `[taskId]` + `[executionId]` (lineage joins later), and the `@@unique([source, sourceId])` (dedup). No further indexes in PR-1 (avoid write amplification on a high-volume table until read patterns are real).

---

## 11. Retention considerations

- `ActivityEvent` will be the **highest-volume table** once the Gateway writes to it (every agent action). PR-1 volume is only the current AuditLog+TimelineEvent rate (modest), but the schema must anticipate growth.
- **Plan (documented, not built in PR-1):** time-based retention — keep hot rows ~90–180 days, then prune/archive; consider monthly partitioning when volume warrants. PR-1 ships only the `createdAt` index that a future prune job needs. No retention job in this PR.

---

## 12. Tests (Postgres-backed — triggers can't be unit-mocked)

Requires a real Postgres test DB with the `vector`/`pgcrypto` extensions (same as RLS/memory tests). Using `vitest`:
- **(a) Mapping correctness:** insert an `AuditLog` row → exactly one `ActivityEvent{source:AUDIT_LOG, actorType:HUMAN, actorId:userId, action, entity…}`. Insert a `TimelineEvent` with `agentId` → `{source:TIMELINE, actorType:AGENT, actorId:agentId, action:type, summary:title, companyId}`. Insert one with `agentId=null` → `actorType:SYSTEM, actorId:null`.
- **(b) Failure isolation (the critical test):** temporarily make the ActivityEvent insert fail (e.g. within a test, a deliberately conflicting/invalid condition) and assert the source `INSERT`/transaction **still commits** and **no** ActivityEvent row is created — proving fail-open.
- **(c) Idempotence:** running the backfill script twice, or a duplicate trigger fire, yields no duplicate rows (unique `(source, sourceId)`).
- **(d) Tenant scoping:** a `where:{companyId:A}` read never returns tenant-B rows; `companyId IS NULL` rows only under a super-admin/no-filter read.
- **(e) Transactional co-commit:** a `TimelineEvent` written inside the `task.ts:162` completion transaction that later **rolls back** must leave **no** ActivityEvent (co-atomicity in the non-exception path).
- **(f) Regression:** existing flows (task complete/fail, delegate, approval resolve, admin audit) behave identically; no read surface changed.

---

## 13. Feature flag / rollout

- The dual-write is a **DB trigger**, which is binary (installed or not) and cannot be cheaply per-tenant-flagged without per-insert overhead. Because PR-1 has **no read consumer** and is **fail-open + additive**, it is safe to ship the triggers **on** — there is zero product-visible effect; the table simply begins accruing rows.
- The meaningful flag is later: when a **read** surface (command-center feed `lib/command/state.ts`, `/overview` timeline) switches from `TimelineEvent` to `ActivityEvent` — that switch is behind a flag in a **later** PR, not PR-1.
- **Kill switch:** a one-statement follow-up migration `DROP TRIGGER … ; DROP FUNCTION …;` disables dual-write instantly without touching the table or data. Documented as the rollback lever (§18-equivalent).
- **Rollout:** deploy migration → verify `ActivityEvent` rows accrue on a demo tenant (`khedmatak`/`refine`) as agents act → confirm no behavior change → done. No gradual enable needed.

---

## 14. Exact files to change

1. `prisma/schema.prisma` — add `model ActivityEvent` + `enum ActivityActorType` + `enum ActivitySource`; add the back-relation `activityEvents ActivityEvent[]` on `Company` (for the optional `company` relation). No changes to `AuditLog`/`TimelineEvent` models.
2. `prisma/migrations/<timestamp>_activity_event/migration.sql` — generated `CREATE TABLE "ActivityEvent"` + enums + indexes + unique, **then hand-appended** raw SQL: `CREATE FUNCTION activity_event_from_source()` (with the EXCEPTION guard + metadata→lineage extraction) and `CREATE TRIGGER` on `AuditLog` and `TimelineEvent`.
3. `lib/activity/types.ts` *(new, small)* — shared TypeScript types (`ActivityActorType`, the row shape) for later PRs; **no writer/reader logic in PR-1**. (Optional — include only if it doesn't expand scope; the Prisma-generated types may suffice.)
4. `scripts/backfill-activity.ts` *(new, optional, not run in PR-1)* — idempotent backfill, deferred.
5. `docs/PR_1_ACTIVITY_EVENT_SPEC.md` — this spec (already added).
6. Tests: `lib/activity/activity-event.test.ts` *(new)* — §12 cases (Postgres-backed).

**Not changed:** the 9 existing writer sites (`admin.ts`, `scheduler.ts`, `task.ts`, `tools.ts`, `approvals.ts`); any read surface; any agent behavior; `lib/db.ts`; middleware. `prisma generate` runs as part of the normal build (`package.json` `build` = `prisma generate && next build`).

---

## 15. Acceptance criteria

1. `ActivityEvent` + the two enums exist; `prisma generate` + `tsc --noEmit` + `next build` are green.
2. Migration applies cleanly on **both** a fresh DB and a copy of the existing schema (no data loss, no destructive change).
3. Every **new** `AuditLog` insert produces exactly one `ActivityEvent` with `source:AUDIT_LOG`, `actorType:HUMAN`, correct `actorId`/`action`/`entity`/`companyId`/ip/ua.
4. Every **new** `TimelineEvent` insert produces exactly one `ActivityEvent` with `source:TIMELINE`, correct `actorType` (AGENT if `agentId`, else SYSTEM), `action=type`, `summary=title`, `companyId`, and best-effort lineage from `metadata`.
5. **Fail-open proven:** a forced trigger-insert failure does **not** break the source insert/transaction (test §12b passes).
6. **Idempotent:** duplicate/backfill inserts create no duplicate `ActivityEvent` (unique `(source, sourceId)`).
7. **No behavior change:** all existing chat/task/delegate/approval/admin flows behave identically; **no read surface** reads `ActivityEvent` yet.
8. Rollback lever documented and verified: dropping the triggers/function stops dual-write with zero data/behavior impact.
9. Lineage columns (`goalId/taskId/executionId/sessionId/contractId`) present and nullable; no lineage manufactured beyond best-effort metadata copy.

---

## Scope guard (what PR-1 explicitly does NOT do)
No Goal Engine · no new agent behavior · no EventOutbox · no Tool Gateway · no enforcement · no economics/LedgerEntry · no RLS enablement · no read-surface switch · no retention/backfill job execution · no capability/policy model. Those are later, separately-approved PRs.

---

*Spec only. No code or migration executed. On approval, implement PR-1 exactly as scoped above — nothing more.*
