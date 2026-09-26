# Phase 0 — Technical Design (Safety & Seams)

**Status:** DESIGN ONLY. No code written, no migrations executed, no production behavior changed. Every proposal cites the current repo object it wraps/extends/depends on.
**Prime directive:** Phase 0 adds **no new agent capability**. It makes the platform *safe, observable, and idempotent*, and lays vendor-neutral seams. Every seam ships **dark (flag-off) and behavior-identical** until explicitly enabled per tenant.
**Incorporates approved decisions 1–11** (defense-in-depth tenancy; two-ledger economics; managed-default provider strategy with routed embeddings; autonomy at Agent×Capability×Context; buy-not-build workspace; outbox-first events; metric-authority; Execution Contract; idempotency-in-Phase-0; identity/runtime decoupling; memory-foundations-only).

---

## 0. Guiding principles from your decisions

- **Defense in depth (Decision 1):** app scope **and** Tool Gateway enforcement **and** DB RLS — not alternatives. RLS becomes the *last* boundary, never the *only* one.
- **Two ledgers (Decision 2):** *Platform Consumption* (tokens/embeddings/search/voice/runtime/email infra → future BZNSS Credits) is distinct from *Agent Operating Spend* (ads/purchasing/refunds/real-world money). Outcome value sits above both (later phase).
- **Identity ≠ Runtime (Decision 10):** `Agent` is durable institutional identity; provider/model/runtime is ephemeral and replaceable. Phase 0 must not persist runtime state on `Agent`.
- **Contract-evaluated execution (Decisions 8–9):** every material action is an **Execution Contract** the gateway evaluates *before* execution; external side effects are idempotent.

---

## 1. Exact Phase 0 scope

**In scope (safety foundations + seams):**
1. **Unified `ActivityEvent`** with dual-write from `AuditLog`/`TimelineEvent` (observability spine).
2. **Tool Gateway**: evolve `executeTool` (`lib/agent/tools.ts:974`) into a pipeline that builds + evaluates an **Execution Contract**; Phase 0 enforces only what already exists (tenant scope, the SAR cap, sensitive-action approval) + idempotency.
3. **Idempotency ledger** for external side effects (retry/reaper-safe).
4. **Tenant defense-in-depth**: adopt `withTenant()` (`lib/db-tenant.ts:17`, currently 0 call sites) on agent, public, job, admin paths + a fail-closed tenant assertion in the gateway; keep RLS permissive.
5. **Capability registry + Agent×Capability policy representation** (data only), *seeded to reproduce today's rules* so behavior is unchanged.
6. **`EventOutbox`** (transactional outbox) with the existing poller as first consumer; resolve the 2 dead trigger events.
7. **Memory hardening**: vector index + similarity threshold + scope enforcement + provider-independent embeddings seam.
8. **Economics seam**: introduce the two-ledger model (see §9), route existing token accounting through the Platform Consumption ledger, scaffold Operating Spend + make the SAR cap a *real gateway check*.
9. **Provider seam for embeddings** + activate the dead `AiModel.isDefault`.

**Explicitly OUT of Phase 0** (later phases): Goal Engine, Outcome Metering, Metric Registry/Service, Business-State snapshot, five-layer memory, Secure Workspace *implementation* (interface stub only), model *task-aware* router, credits customer UX, distributed queue.

---

## 2. Existing files/functions/schema objects touched

| Area | Object (current) | Phase 0 action |
|---|---|---|
| Tool dispatch | `executeTool(name,rawArgs,ctx)` `lib/agent/tools.ts:974`; `ToolContext {companyId,agentId}` `:21` | **Wrap** in gateway; extend context |
| Tool gate | `getToolsForAgent`/`getToolsForCompany` `lib/agent/tools.ts:52,83`; `PRIVILEGED_TOOLS` | **Depend on** (unchanged); feed capability registry |
| Run loop | `runToolLoop`/`runToolLoopStream` `lib/agent/core.ts:112,159`; call site `:141` | **Depend on**; pass contract context into `executeTool` |
| Entrypoints | `runAgentChat` `lib/agent/run.ts:53`, `runPublicAgentChat` `lib/agent/public-chat.ts:75`, `runAgentTask` `lib/agent/task.ts:49`, sandbox | **Depend on**; supply actor/tenant to contract |
| Task claim/reaper | `runAgentTask` claim `task.ts:80-85`; `runReapStuckTasks` `lib/agent/scheduler.ts:97-128` | **Interoperate with** idempotency keys |
| Events | `dispatchEvent` `lib/agent/events.ts:19-56`; producers `app/api/public/[slug]/order/route.ts:180`, `.../chat/route.ts:155`, `lib/agent/tools.ts:1550,1725` | **Redirect** to `emitEvent`→outbox; move matching to consumer |
| Cron | `runCronWork` `lib/cron/run-tick.ts:22-44` | **Add** `dispatchOutbox()` to the Promise.all |
| Economics | `checkTokenBudget`/`chargeTokens` `lib/billing/tokens.ts:18-45`; `checkAgentBudget`/`chargeAgentTokens` `lib/billing/agent-tokens.ts:18-54`; `Wallet`/`WalletTransaction` `schema:1917-1961` | **Route through** Consumption ledger; **add** Operating Spend |
| Guardrails | `resolveGuardrails` + prompt injection `lib/agent/prompt.ts:130-144,238-243` (`spendApprovalCapSar`) | **Promote** to gateway enforcement (keep prompt as UX hint) |
| Approvals | `Approval` `schema:888`; `request_approval` tool | **Reuse** for gateway-parked contracts |
| Audit | `AuditLog` `schema:1793`; `TimelineEvent` `schema:1574` | **Dual-write** into `ActivityEvent` |
| Tenancy | `getUserCompany` `lib/companies.ts:103`; plain `PrismaClient` `lib/db.ts:7`; RLS migs `20260620170000_rls_policies`, `20260622120000_tenant_files`; `withTenant` `lib/db-tenant.ts:17` | **Activate** `withTenant`; keep RLS permissive |
| AI providers | `getProviderForCompany`/`getProviderForModel` `lib/ai/index.ts:95,87`; `getEmbedding` `lib/ai/embeddings.ts:40`; `AiModel.isDefault` (dead) | **Add** embeddings provider seam; **activate** `isDefault` |
| Memory | `recallMemories`/`saveMemory` `lib/agent/memory.ts:21,52`; `AgentMemory.embedding` `schema:583` | **Index + threshold + scope** |
| Enums | `Task.triggerType` free-text `schema:790`; `TriggerEvent` `schema:1123-1129` | **Promote** triggerType to enum; resolve dead events |

New models (all additive, nullable-first): `ActivityEvent`, `IdempotencyRecord`, `EventOutbox`, `LedgerEntry` (see §9 simpler alt), `Capability` + `AgentCapabilityPolicy`, optional `FeatureFlag`. No destructive migration; no existing column dropped.

---

## 3. Proposed request/execution flow for an agent tool call

Today: `runToolLoop` → `executeTool(name,args,{companyId,agentId})` → `switch` → Prisma/MCP (`core.ts:141` → `tools.ts:974`).

Phase 0 (gateway pipeline; same entry signature, wrapped):
```
runToolLoop
  → gateway.execute(contractInput)                       // was executeTool(name,args,ctx)
      1. buildContract(actor, tenant, capability, args)  // §5
      2. resolveCapabilityMeta(capability)               // registry: risk, reversible, external, ledgerImpact
      3. policyCheck(agent × capability × context)        // §6 → ALLOW | DENY | NEEDS_APPROVAL
      4. tenantAssert(contract.tenantId === ctx.companyId) // fail-closed  §4
      5. budgetCheck(ledgerImpact)                         // consumption &/or operating-spend  §9
      6. approvalGate(if NEEDS_APPROVAL) → park + Approval // §8 → returns pending
      7. idempotencyBegin(idempotencyKey) if external      // §11 → cached result short-circuits
      8. execute → existing executeTool switch / callMcpTool (UNCHANGED body)
      9. meter(actualCost) → ledger; idempotencyCommit
     10. activityWrite(contract, decision, outcome)        // §10
  → tool result string (same shape as today)
```
**Phase 0 default = log-only** (steps 1,2,3,10 run; 4–9 observe/measure but do not block) behind `gateway.enforce=false`. Enforcement is enabled per-check, per-tenant. Reads and internal-DB writes skip idempotency (step 7). The `executeTool` `switch` body (`tools.ts:975-2030`) is **not modified** — the gateway wraps it.

---

## 4. Tenant-enforcement flow (defense in depth)

Three layers, adopted incrementally:

**Layer 1 — Application scope (exists, keep):** every query already `where:{companyId}`. Unchanged.

**Layer 2 — Gateway tenant assertion (new, fail-closed):** the contract carries `tenantId`; the gateway asserts `contract.tenantId === resolvedTenant` and that any `resource.id` referenced belongs to that tenant *before* execution. This catches a forgotten `where` at the capability boundary.

**Layer 3 — Database RLS (exists, activate):** adopt `withTenant(companyId, fn)` (`lib/db-tenant.ts:17`) which sets `app.current_tenant_id`; the permissive policy (`migration.sql:25-29`) then becomes *active* for those connections. Migration path per surface:

| Surface | Entry points | Phase 0 step |
|---|---|---|
| **Agent execution** | `runAgentChat`/`runAgentTask`/`runPublicAgentChat`/sandbox → `executeTool` | Wrap the tool-execution DB work in `withTenant(ctx.companyId,…)`; highest priority (autonomous, highest blast radius) |
| **Public/storefront** | `app/(public)/[slug]/*`, `app/api/public/[slug]/*` | Resolve tenant from slug, then `withTenant` around all reads/writes |
| **Background jobs** | `runDueTasks`/`runDueSchedules`/reaper `lib/agent/scheduler.ts` | Pin `withTenant` per task's `companyId` inside the per-task loop |
| **Admin/system** | `lib/actions/admin*.ts` (`requireSuperAdmin` `lib/admin.ts:21`) | System ops legitimately cross tenants → run WITHOUT the GUC (policy stays permissive) OR set GUC per-tenant when operating on one tenant; never a wildcard bypass token |

RLS stays **permissive-when-unset** through all of Phase 0 (un-migrated code unaffected). Flipping any policy to deny-by-default is a **Phase 1+** decision, gated on 100% GUC coverage + the cross-tenant test suite (§17) passing. **Invariant:** RLS is never loosened below today.

---

## 5. Execution Contract structure (proposed shape — not migrated)

Built per material action, evaluated by the gateway, recorded in `ActivityEvent`.
```
ExecutionContract {
  contractId:      string            // uuid
  idempotencyKey:  string            // deterministic; retry/reaper-safe (§11)
  actor:  { type: 'HUMAN'|'AGENT'|'SYSTEM', id: string, tenantId: string }
  ownerId?:        string            // accountability (Agent.ownerId, added Phase 1)
  context: { goalId?, taskId?, delegationId?, conversationId? }
  capability:      string            // capability id == tool key (registry §7)
  resource:        { type: string, id?: string, scope?: object }   // "on what"
  dataScope:       'OWN'|'TENANT'|'RECORD'                          // read/write breadth
  risk:            'L0'|'L1'|'L2'|'L3'|'L4'|'L5'                    // §6/§7 taxonomy
  effect:          { reversible: boolean, external: boolean, kind: string }
  cost:            { estimated?: LedgerCharge[], actual?: LedgerCharge[] }  // §9
  approval:        { required: boolean, approvalId?: string, status?: ApprovalStatus }
  runtime?:        { provider?: string, model?: string }           // EPHEMERAL, never on Agent
  createdAt:       Date
}
LedgerCharge { ledger: 'PLATFORM_CONSUMPTION'|'OPERATING_SPEND', unit: string, amount: number, currency?: 'SAR' }
```
Reads produce a lightweight contract (risk L0/L1, no idempotency, no ledger). Only **material/side-effecting** actions carry the full contract + idempotency.

---

## 6. Policy evaluation model (Agent × Capability × Context)

A decision is **not** a single `Agent.autonomy` property (today `AutonomyLevel` `SUGGEST/ASK/AUTOPILOT`). It resolves over three axes:

- **Capability** → default risk + defaults (from the registry §7).
- **Agent** → per-agent overrides (`AgentCapabilityPolicy`).
- **Context** → predicates (amount thresholds, resource class, business hours, target audience) — **deferred content**, but the evaluation slot exists in Phase 0.

Autonomy taxonomy (Decision 4), mapped to gateway decisions:
| Level | Meaning | Gateway decision |
|---|---|---|
| L0 Observe | read only | ALLOW if read |
| L1 Recommend | propose, never act | produce output only; side effect → NEEDS_APPROVAL |
| L2 Execute reversible low-risk | ALLOW if `effect.reversible && !external` |
| L3 Execute within policy | ALLOW if within budget/context predicates |
| L4 Human approval required | NEEDS_APPROVAL |
| L5 Prohibited | DENY always |

**Evaluation:** gather rules for (agentId → archetype → '*') × capability; most-specific wins; yields an allowed level + context predicates; compare to the action's risk/effect/cost → `ALLOW | DENY | NEEDS_APPROVAL` with machine-readable reasons.

**Phase 0 seeding (behavior-identical):** derive rules from *existing* config so nothing changes — `surface` gates customer/internal (as today), `permissions[]` = the capability allow-list (as today), `AutonomyLevel` maps SUGGEST→L1 / ASK→L3-with-approval-on-sensitive / AUTOPILOT→L3, guardrail flags (`requireApprovalForSensitive`, `spendApprovalCapSar`) become L4 predicates. **Example (your discount case):** read customers = L0/ALLOW; low-risk follow-up = L2/ALLOW; discount over cap = L4/NEEDS_APPROVAL; delete financial record = L5/DENY.

> **Over-engineering flag:** a full rules engine with arbitrary Context predicates is more than current scale needs. **Simpler Phase 0:** a `Capability` risk table + optional per-agent override row + the four guardrail predicates already in `prompt.ts`. Ship the Context axis as a stored-but-mostly-empty JSON field; add real predicates only when a concrete use case lands.

---

## 7. Autonomy/capability representation (data, additive)

- **`Capability`** (evolve the thin `Tool` `schema:660` + client `TOOL_CATALOG` in `lib/agent/tool-labels.ts`): `{ id (==tool key), label, group, riskDefault (L-level), reversible, external, dataClass ('PII'|'FINANCIAL'|'PUBLIC'|'INTERNAL'), requiresApprovalDefault, ledgerImpact ('NONE'|'PLATFORM'|'OPERATING'), costModel? }`. Seeded from the current `AGENT_TOOLS` list + `PRIVILEGED_TOOLS` classification.
- **`AgentCapabilityPolicy`** `{ agentId, capabilityId, autonomyLevel, contextRules Json, budget?, expiresAt? }` — optional overrides; absence = capability default. Coexists with `Agent.permissions[]` (the allow-list still gates *which* capabilities exist; the policy governs *how* they may be used).
- **Identity/runtime decoupling (Decision 10):** `Agent` keeps identity (purpose/role/permissions/policies/budget refs/history); a separate **`AgentRuntimePolicy`** (data: preferred tier, provider constraints) expresses runtime preference without binding the Agent to a provider. No live runtime state is stored on `Agent`.

---

## 8. Approval flow

Today: the *model* decides to call `request_approval`; nothing forces it. Phase 0 adds a **structural** path (keeps the tool path too):

1. Gateway policy → `NEEDS_APPROVAL`.
2. **Park** the Execution Contract: persist it keyed by `idempotencyKey` (status `PENDING_APPROVAL`), create an `Approval` (`schema:888`) linked to `contractId`, return `{status:'pending_approval'}` to the agent (the loop reports "awaiting your approval").
3. Owner resolves in `/approvals` (existing UI + `lib/actions/approvals.ts`).
4. On **approve** → the parked contract is **replayed through the gateway** (idempotent — same key) and executes exactly once; on **reject** → contract marked `DENIED`, no effect.
5. Every transition writes `ActivityEvent`.

This makes `requireApprovalForSensitive` / `spendApprovalCapSar` **enforced**, not advisory.

---

## 9. Platform Consumption ledger vs Operating Spend ledger

Two economic domains (Decision 2), kept separate:

- **Platform Consumption** (LLM/tokens/embeddings/search/voice/browser-runtime/email infra → future BZNSS Credits). Phase 0 **wraps** the existing token accounting (`Company.tokenBalance`, `Agent.tokenLimit`/`periodTokensUsed`, `lib/billing/*`) — those numbers stay authoritative — and additionally records each metered event so consumption is itemizable by unit and mappable to credits later.
- **Operating Spend** (ads/purchasing/refunds/paid external actions — *real money the agent is authorized to move*). New, currency-denominated, **enforced by the gateway budget check** (this is where `spendApprovalCapSar` becomes real). No such tools exist today, so Phase 0 ships the **scaffold + the enforcement hook**, future-proofing the moment a paid-action capability lands.
- **Outcome/value attribution** sits above both — **deferred** (Phase 5).

**Proposed model (simpler alt — recommended):** one append-only **`LedgerEntry`** table with a discriminator instead of two tables:
```
LedgerEntry { id, companyId, agentId?, ledgerType: 'PLATFORM_CONSUMPTION'|'OPERATING_SPEND',
              unit: string ('tokens'|'embeddings'|'sar'|…), amount, currency?, balanceAfter?,
              contractId?, idempotencyKey?, category?, createdAt }
```
Mirrors the proven `WalletTransaction` ledger pattern (`schema:1930`, `reference @unique` for dedup). `WalletTransaction` (SAR top-ups/subscriptions) stays as-is; `LedgerEntry` is the agent-economics ledger.

> **Over-engineering flag:** two physically separate ledger tables + double-entry accounting is premature. Single `LedgerEntry` with a `ledgerType` discriminator gives the conceptual separation now; split later only if reporting/regulatory needs demand it.

---

## 10. `ActivityEvent` model + dual-write migration

**Proposed model:**
```
ActivityEvent { id, companyId, actorType: 'HUMAN'|'AGENT'|'SYSTEM', actorId,
                action: string, entityType?, entityId?, capability?, contractId?,
                decision?: 'ALLOW'|'DENY'|'NEEDS_APPROVAL', cost? Json, outcome? Json,
                ip?, userAgent?, metadata? Json, at DateTime }
@@index([companyId, at]); @@index([actorType, actorId]); @@index([entityType, entityId])
```
**Dual-write migration (non-destructive):**
1. Add `ActivityEvent`. Gateway writes one per contract.
2. Add a thin shim in the `AuditLog` creator and the `TimelineEvent` creators (they're written from `lib/actions/*`, `lib/agent/tools.ts`, `scheduler.ts`, `task.ts`) to *also* emit an `ActivityEvent` — or a Postgres AFTER-INSERT trigger on both tables (cheaper, no code churn). Prefer the trigger for `AuditLog`/`TimelineEvent` and direct writes from the gateway.
3. Backfill (optional) historical rows.
4. Point read surfaces (command-center feed `lib/command/state.ts`, `/overview` timeline) at `ActivityEvent`.
5. Deprecate the old writers **in a later phase**. Phase 0 keeps `AuditLog` + `TimelineEvent` intact (backward compat).

---

## 11. Idempotency mechanism (Phase 0 prerequisite for external effects)

**Model:** `IdempotencyRecord { key @unique, companyId, capability, status: 'PENDING'|'DONE'|'FAILED', resultHash?, result? Json, createdAt, expiresAt }`.

**Key derivation:** deterministic so a retry reuses it. For scheduler/reaper-originated work: `hash(taskId + ':' + logicalActionOrdinal + ':' + capability + ':' + normalizedArgs)`. For owner-approved parked contracts: the contract's own `idempotencyKey`. For interactive chat side effects: `hash(agentId + conversationTurnId + capability + normalizedArgs)`.

**Gateway protocol (external, side-effecting capabilities only):**
1. `INSERT IdempotencyRecord(key, PENDING)` — unique constraint.
2. On **conflict + DONE** → return stored `result` (no re-execution).
3. On **conflict + PENDING** → another execution in flight → serialize/reject (`in_progress`).
4. Execute → on success `UPDATE … DONE, result`; on failure `FAILED` (allows a real retry).

**Reaper interplay (the core reason this is Phase 0):** `runReapStuckTasks` (`scheduler.ts:97-128`) re-queues WORKING>15min tasks; `runAgentTask` re-runs them. With idempotency, a re-run whose `create_order`/`create_booking`/`send_message`/refund already committed returns the cached effect instead of duplicating. **Protected capabilities (map to current cases):** `create_order` (`tools.ts:1725` area), `create_booking`, `update_booking`, any messaging (Channels `lib/actions/channels.ts`, notifications `lib/notifications/*`), future payments/refunds (`lib/payments/tap.ts`). `create_lead`/`create_output` are lower-risk (dedupe by natural key optional). Reads exempt.

> **Over-engineering flag:** a global idempotency layer over *every* tool is unnecessary — internal DB writes are already tenant-claimed/transactional. Scope idempotency to **external/irreversible** capabilities (the list above).

---

## 12. `EventOutbox` model + dispatcher semantics

**Model:** `EventOutbox { id, companyId, type: TriggerEvent, payload Json, status: 'PENDING'|'DISPATCHED'|'FAILED', availableAt, attempts, createdAt, dispatchedAt? }` `@@index([status, availableAt])`.

**Producer (transactional outbox):** business producers keep their call sites but target a thin `emitEvent(companyId, type, payload, tx?)` that **INSERTs an outbox row in the same transaction as the state change**. Current producers: `app/api/public/[slug]/order/route.ts:180`, `.../chat/route.ts:155`, `lib/agent/tools.ts:1550` (lead), `:1725` (order). `dispatchEvent` (`lib/agent/events.ts:19-56`) is refactored so its *matching* logic (find `EventTrigger`s → create Tasks) moves to the consumer.

**Consumer:** a new `dispatchOutbox()` added to `runCronWork`'s `Promise.all` (`lib/cron/run-tick.ts:22-44`): claims PENDING rows (same conditional-`updateMany` claim pattern as tasks), runs the matching→Task creation, marks `DISPATCHED`. At-least-once delivery; consumer is idempotent (task creation keyed to `{outboxId, triggerId}`).

**Swap-ability (Decision 6):** producers only know `emitEvent`; the consumer (`dispatchOutbox`) is the *only* thing that reads the transport. Replacing the poller with a durable queue later touches **only the consumer**, never producers. No external broker in Phase 0.

---

## 13. Memory / RAG hardening (foundations only — Decision 11)

Targeting `lib/agent/memory.ts` + `AgentMemory` (`schema:575`):
1. **~~Vector index~~ — ALREADY DONE (correction, verified via CI 2026-09-26).** A pgvector **HNSW** index already exists on `AgentMemory.embedding` — created by raw SQL in migration `20260621110000_agent_memory_hnsw` (`USING hnsw ("embedding" vector_cosine_ops)`), superseding the init migration's ivfflat index. The earlier assessment's claim of "no vector index / seq-scan" was wrong. **Do NOT include "add a vector index" as outstanding memory work.** (Aside: because the column is `Unsupported("vector(1536)")`, `prisma migrate diff` can't represent this index and always reports it as drift — see the PR-1 CI workflow comment; `migrate status` is the drift authority.)
2. **Similarity threshold:** `recallMemories` (`memory.ts:52-82`) filters by a max cosine distance so irrelevant memories aren't injected when nothing is truly relevant (today it always returns top-K).
3. **Scope enforcement:** recall is already `agentId+companyId`-scoped; formalize a `dataScope` parameter and assert `companyId` at the raw-SQL boundary (belt-and-suspenders with RLS §4).
4. **Provider-independent embeddings seam (Decision 3):** introduce `getEmbeddingProvider(companyId)` mirroring `getProviderForCompany` (`lib/ai/index.ts:95`); `getEmbedding` (`lib/ai/embeddings.ts:40`) routes through it. Managed default stays Vertex, but switching becomes config, not code. **Caveat documented:** changing embedding model/dim invalidates existing vectors (different space) → requires a re-embed job; Phase 0 only adds the seam and keeps Vertex/1536.

No knowledge-graph, no five-layer memory, no chunked-doc RAG in Phase 0.

---

## 14. Exact handling of current dead trigger events

`TriggerEvent` (`schema:1123-1129`) declares `ORDER_PAID` and `CART_ABANDONED`, both configurable in the scenario UI (`lib/agent/events-catalog.ts`) and validator, but **never dispatched** (verified). Both are silent no-ops today.

- **`ORDER_PAID`** — a real source exists. Emit it at the payment-settled transition: the Tap webhook (`app/api/payments/tap/webhook/route.ts`) and any `Order.paymentStatus → PAID` write. Phase 0: add the `emitEvent(companyId,'ORDER_PAID',…)` at that transition (via the outbox §12). This makes an already-configurable trigger actually fire.
- **`CART_ABANDONED`** — **no cart concept exists** in the schema (there is `Order` with statuses, no cart). It cannot fire correctly without either a cart/draft-order model or a scheduled "stale draft" detector — both out of Phase 0 scope. **Decision needed:** either (a) **remove** `CART_ABANDONED` from the enum + catalog + validator (cleanest — stop offering a dead trigger), or (b) keep it but **hide it in the UI** with a "coming soon" flag. Recommend (a) for now.

---

## 15. Rollout strategy & feature flags

- **Flag store:** a small `FeatureFlag` table (`{ companyId?, key, enabled, value? }`) or reuse `PlatformSettings` (`schema:1873`, already the singleton) for global flags + a per-company JSON. Env fallback for infra flags.
- **Flags:** `gateway.enabled` (build+log contracts), `gateway.enforce.tenant`, `gateway.enforce.spendCap`, `gateway.enforce.approval`, `gateway.enforce.idempotency`, `tenant.rls.<surface>`, `outbox.enabled`, `memory.threshold`, `embeddings.router`.
- **Sequence:** land each seam **dark** → enable **log-only** globally → turn on **enforcement per-check** on a **demo tenant first** (`khedmatak`/`refine`, per the demo-tenants memory) → verify via `ActivityEvent` + tests → roll to all tenants. The autonomy engine's existing heartbeat (`PlatformSettings.lastCronRunAt`, surfaced at `/api/version`) monitors the outbox consumer.

---

## 16. Backward compatibility plan

- **Additive only:** new models + nullable columns; no dropped column, no destructive migration. `AuditLog`/`TimelineEvent` retained. `Agent.permissions[]`, `AutonomyLevel`, `request_approval`, token accounting all keep working.
- **Behavior-identical when flags off:** the gateway with `enforce=*false*` runs the existing `executeTool` switch unchanged; policy is seeded to reproduce today's `surface`/`permissions`/guardrail behavior.
- **Public storefront untouched** in Phase 0 except the additive `withTenant` wrap (which is a no-op while RLS is permissive) and the `ORDER_PAID` emit.
- **Providers:** managed default stays Vertex; embeddings seam defaults to current behavior.

---

## 17. Test strategy (cross-tenant + duplicate-side-effect first)

- **Cross-tenant (highest priority):** seed 2 tenants; for **every** agent capability and **every** public route, attempt to read/mutate tenant B's rows while acting as tenant A → expect empty/deny. Add a **negative RLS test**: with the GUC set to tenant A, a deliberately-wrong query (missing `where:{companyId}`) must still return zero tenant-B rows (proves the DB boundary once enforced).
- **Duplicate side-effect:** simulate (a) reaper re-run of a WORKING task that already created an order/booking, (b) double outbox dispatch, (c) approve→replay of a parked contract → assert **exactly one** external effect via `IdempotencyRecord`.
- **Contract/policy unit tests:** the discount/read/delete matrix from §6 → correct ALLOW/DENY/NEEDS_APPROVAL.
- **Approval park/resume:** NEEDS_APPROVAL parks, no effect; approve executes once; reject executes never.
- **Outbox:** at-least-once + idempotent consumer (no duplicate Task per event).
- **Regression:** existing chat/task/public flows byte-identical with flags off. (Test infra note: the repo has `vitest`; a Postgres test DB with the `vector` extension is required for RLS/memory tests.)

---

## 18. Failure / rollback behavior

- **Per-check fail modes:** tenant assertion + idempotency (external effects) = **fail-closed** (don't execute if the boundary/once-guarantee can't be ensured). Cost metering + `ActivityEvent` write = **fail-open + alert** (never block a legitimate action because logging hiccuped). Policy engine error = **fail-closed for L≥4/L5**, fail-open-but-log for reads.
- **Outbox consumer crash:** rows stay `PENDING`, retried next tick; `attempts` cap → `FAILED` + alert (mirrors the task reaper).
- **Rollback:** every seam is flag-guarded → disable the flag to instantly revert to current behavior. Additive schema means no data migration to undo; a bad PR reverts cleanly. RLS is never flipped to deny-by-default in Phase 0, so there is no "locked out" failure mode.

---

## 19. Security invariants (must never be bypassed)

1. **No side-effecting tool executes without a gateway-approved Execution Contract** whose `tenantId` equals the resolved tenant.
2. **A contract can never target another tenant's resource** (Layer-2 assertion + Layer-3 RLS); RLS is never loosened below today's state.
3. **Secrets never enter the LLM context or tool args** — the credential broker (later) injects at the provider/tool boundary only; today's encrypted secrets (`lib/encryption.ts`; `McpServer.authToken`, `Channel.token`, `CompanyApiSettings.byokApiKey`) are never returned to the model.
4. **Privileged capabilities** (`create_agent`/`configure_agent`/`list_agents`, `PRIVILEGED_TOOLS`) are never reachable on the public surface (keep the current default-deny in `runPublicAgentChat`).
5. **External/irreversible effects require a committed `IdempotencyRecord`.**
6. **L4 actions cannot execute without a resolved `Approval`; L5 never executes.**
7. **Operating Spend over policy cap is blocked in code**, not merely discouraged in the prompt.

---

## 20. Proposed PR sequence (small, single-responsibility, all dark by default)

1. **PR-1 `ActivityEvent` + dual-write** (model + trigger/shim; read surfaces still on old tables). Pure observability.
2. **PR-2 Execution Contract + Gateway pass-through** — wrap `executeTool`; build+log contracts; enforce nothing. (`lib/agent/core.ts:141`, `tools.ts:974`.)
3. **PR-3 Idempotency ledger** — `IdempotencyRecord`; wrap external side-effecting capabilities; reaper-safe keys. (§11)
4. **PR-4 Tenant enforcement: agent path** — `withTenant` around tool execution + gateway tenant assertion (flagged). (`lib/db-tenant.ts:17`.)
5. **PR-5 Tenant enforcement: public + jobs + admin** — extend `withTenant` coverage.
6. **PR-6 Capability registry + Agent×Capability policy (data)** — seed to reproduce today's rules; gateway reads, enforces nothing new.
7. **PR-7 Enforce existing guardrails** — SAR cap + sensitive-action → gateway NEEDS_APPROVAL; approval park/resume. (§8; `prompt.ts:130-144`.)
8. **PR-8 `EventOutbox` + `emitEvent` producers + `dispatchOutbox` consumer** — behavior preserved. (§12.)
9. **PR-9 Dead events** — wire `ORDER_PAID`; remove/hide `CART_ABANDONED`. (§14.)
10. **PR-10 Memory hardening** — vector index migration + threshold + scope. (§13.)
11. **PR-11 Embeddings provider seam + activate `AiModel.isDefault`** — routed embeddings; model-default respected. (§13, `lib/ai/index.ts`.)
12. **PR-12 Economics ledger** — `LedgerEntry`; route token accounting through Platform Consumption; scaffold Operating Spend + wire the cap check from PR-7. (§9.)
13. **PR-13 `Task.triggerType` → enum** + tidy stale comment. (`schema:790`.)

Each PR: additive schema, flag-guarded, its own tests (cross-tenant/idempotency where relevant), independently revertible.

---

## Over-engineering summary (explicit, per your request)

| Proposed | Over-engineered for BZNSS scale? | Simpler Phase 0 alternative |
|---|---|---|
| Agent×Capability×**Context** rules engine | Context axis yes | Capability risk table + per-agent override + the 4 existing guardrail predicates; ship Context as an empty JSON slot |
| **Two** physical ledger tables + double-entry | Yes | One `LedgerEntry` with `ledgerType` discriminator |
| Global idempotency over **all** tools | Yes | Idempotency only for external/irreversible capabilities |
| Distributed queue / broker | Yes | Transactional outbox + existing poller |
| Task-aware **model router** | Yes (Phase 0) | Only the embeddings seam + activate `isDefault`; defer routing |
| Metric Registry/Service | Yes (Phase 0) | Defer entirely to Phase 5 |
| Replace both audit logs now | Yes | Dual-write only; keep old tables; migrate reads later |
| `WorkspaceProvider` implementation | Yes | Interface stub only; no runtime in Phase 0 |
| RLS deny-by-default now | Yes / risky | Keep permissive; enforce via `withTenant` coverage; flip later |

---

*Design only. No code or migrations executed. Awaiting approval before implementation, and a decision on `CART_ABANDONED` (§14) and the single-vs-two ledger table (§9).*
