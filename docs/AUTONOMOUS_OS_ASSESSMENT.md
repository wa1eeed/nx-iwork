# BZNSS → Autonomous Business OS — Principal-Architect Assessment

**Status:** read-only assessment. No code, migrations, or agent behavior changed.
**Method:** four parallel read-only inspection passes (auth/tenancy/billing; AI provider layer; events/scheduler/tasks/memory; full schema/modules/integrations), verified against source. Every claim cites `path:line`.
**Repo:** `/Users/aa/nx-iwork-main` — Next.js 16 App Router, Prisma/Postgres (61 models; `vector`/`pg_trgm`/`pgcrypto`), NextAuth v5, next-intl. Deploy: Coolify (`/api/version` heartbeat).

---

## A. Current State Assessment (what is actually implemented)

### A.1 Tenancy & auth
- **Tenant = `Company`** (`prisma/schema.prisma:88`). A user maps to **one** company via a single nullable FK `User.companyId` (`schema.prisma:42-43`). **No membership/M2M model, no per-company role table** — role is a flat column `User.role` (`UserRole { SUPER_ADMIN, BUSINESS_OWNER, BUSINESS_MEMBER }`, `schema.prisma:25-29`).
- **Auth:** NextAuth v5, JWT sessions, single Credentials provider + bcrypt (`lib/auth.ts:11,12-47`). Split edge-safe config (`lib/auth.config.ts`). Super-admin via DB role **or** env allowlist `SUPER_ADMIN_EMAILS` (`lib/admin-allowlist.ts:15-25`).
- **Tenant resolution chokepoint:** `getUserCompany(userId)` (`lib/companies.ts:103-114`) — reads `companyId` fresh, honors an impersonation cookie only for `SUPER_ADMIN`. `dashboardCompanyIdOrRedirect` (`lib/companies.ts:123-133`). Impersonation = signed 4h HMAC cookie (`lib/impersonation.ts`).
- **Isolation is application-level.** Every query is hand-scoped `where: { companyId }`. The Prisma client is a plain `PrismaClient` with **no `$extends`/`$use` middleware** (`lib/db.ts:7-11`) — no global tenant filter.
- **Row-Level Security exists but is effectively inert.** Raw-SQL migrations enable + FORCE RLS and create `tenant_isolation` policies on 28 tables (`prisma/migrations/20260620170000_rls_policies/migration.sql:18-38`; `.../20260622120000_tenant_files/migration.sql:24-36`). But the policy is **permissive-by-default** (allows when the GUC is unset — `migration.sql:25-29`), and the GUC `app.current_tenant_id` is pinned in **exactly one place** (`lib/agent/hr-agent.ts:256`); the helper `withTenant()` (`lib/db-tenant.ts:17-25`) has **zero call sites**. Net: RLS is a scaffold, not an enforced boundary.

### A.2 AI / model layer
- **Clean provider abstraction.** `interface AiProvider { complete(); completeStream?() }` (`lib/ai/types.ts:84-91`); four adapters (`lib/ai/providers/{anthropic,google,vertex,openai}.ts`); business logic never imports a vendor SDK — it goes through `getProviderForCompany()` (`lib/ai/index.ts:95-123`).
- **But the default runtime is Gemini/Vertex-coupled.** Managed mode returns Vertex only (`lib/ai/index.ts:100-103`); other vendors need BYOK (`CompanyApiSettings.byokApiKey`, AES-256-GCM) or a per-agent pinned registry model + platform key. **Embeddings are Vertex-only** (`lib/ai/embeddings.ts`).
- **No model router.** Selection is static per agent: `Agent.model` tier (`HAIKU/SONNET/OPUS`) + optional `Agent.aiModelId` pin (`schema.prisma:423-431`). `lib/agent/router.ts` is an *inbound-intent* router, not a model router. `AiModel.isDefault` is **written but never read at runtime** (dead — `lib/actions/admin-models.ts:54-55` is the only writer).
- **Run loop:** `runToolLoop` / `runToolLoopStream`, `MAX_TOOL_ROUNDS = 5` (`lib/agent/core.ts:11,112-215`). Callers: `runAgentChat` (`lib/agent/run.ts:53`), `runPublicAgentChat` (`lib/agent/public-chat.ts:75`), `runAgentTask` (`lib/agent/task.ts`), sandbox. Streaming is asymmetric — Vertex + OpenAI stream; Anthropic + Google (REST) fall back to non-streamed.

### A.3 Agents, tools, memory
- **`Agent`** (`schema.prisma:384`) already carries much of an institutional identity: `companyId` (tenant), `departmentId`, `parentId` (manager), `role`, `jobDescription` (purpose), `permissions[]` (tool allow-list), `archetype`, `surface` (CUSTOMER_FACING/INTERNAL), `autonomy` (`SUGGEST/ASK/AUTOPILOT`), `model`/`aiModelId`, `status`, `tokenLimit`/`periodTokensUsed`, timestamps.
- **Tool system = the de-facto capability layer.** `executeTool(name, args, ctx)` (`lib/agent/tools.ts:974`) is the single in-process dispatch chokepoint; `getToolsForAgent(modules, permissions)` (`tools.ts:83`) intersects module gates + the per-agent allow-list, with `PRIVILEGED_TOOLS` (`create_agent`/`configure_agent`/`list_agents`) granted only when named. Internal BZNSS modules are **already** agent tools (CRM, catalog, bookings, orders, tasks, outputs). External tools come via **MCP** (`lib/mcp/registry.ts`, per-company `McpServer`, SSRF-guarded `lib/net/ssrf.ts`, encrypted `authToken`) and messaging **Channels** (Telegram/WhatsApp). **Tools hit the DB directly under `ctx.companyId`** — there is no separate policy/budget/credential-broker pipeline between agent and data.
- **Maestro conductor** (built earlier this session): `archetype:'conductor'`, an INTERNAL agent that builds/configures agents from chat (`create_agent`/`configure_agent`/`list_agents`/`list_outputs`), provisioned by `ensureConductor()` (`lib/agent/conductor.ts`); the `/command` neon radar is the home.
- **Memory (two real layers):** `AgentMemory` — pgvector `vector(1536)` (`schema.prisma:583`), cosine kNN recall (`lib/agent/memory.ts:52-82`) but **no similarity threshold** (*correction 2026-09-26: a pgvector **HNSW** index already exists — migration `20260621110000_agent_memory_hnsw`; recall is index-backed, not seq-scan*); and `CompanyDNA` — a static business-knowledge **blob injected wholesale into the prompt** (`schema.prisma:197-213`, no retrieval). `cognitiveOnboard` seeds just 2 memory rows. No episodic or cross-agent shared memory.

### A.4 Events, scheduling, tasks, delegation
- **"Event bus" = synchronous in-process function.** `dispatchEvent(companyId, event, ctx)` (`lib/agent/events.ts:19-56`) writes PENDING `Task` rows; delivery is deferred to DB polling. No queue/pub-sub. `TriggerEvent` has 5 values (`schema.prisma:1123-1129`) but only **3 are ever raised** — `ORDER_PAID` and `CART_ABANDONED` are configurable in the UI yet **never fired** (dead).
- **Scheduler = `setInterval` + Postgres polling.** `runCronWork()` fires 5 jobs (`runDueSchedules/runDueTasks/runDueReminders/runReapStuckTasks/runDueRenewals`) via `Promise.all` (`lib/cron/run-tick.ts:22-44`). Three entry points: in-process `CRON_SELF` (`lib/cron/self-scheduler.ts`, `instrumentation.ts:31-36`), HTTP `/api/cron/run` (`CRON_SECRET`-guarded), and a standalone script (which runs only 2 of 5 jobs). Dedup via a 55s DB **lease** on `PlatformSettings` + a per-`Task` status claim. **No external queue** (no bullmq/redis/pg-boss/etc.).
- **Task execution:** `runAgentTask` (`lib/agent/task.ts:49-213`) claims atomically, records `TaskAttempt`, runs the same tool loop, no inline retry; a reaper re-queues WORKING>15min up to 3 attempts. `Task.dependsOn[]` chains are enforced (`lib/agent/scheduler.ts:236-279`). `Task.triggerType` is **free-text String** (stale comment; no enum).
- **Delegation is a bare task.** `delegate_to_agent` (`tools.ts:1853-1916`) persists a `Task` with free-text `title`/`description`, `triggerSource:{delegatedByAgentId}`, optional `dependsOn` — **no deadline, budget, priority, or success criteria**.

### A.5 Economics, approvals, audit
- **Token accounting is hard-enforced** at every entrypoint: company bank `Company.tokenBalance` (`lib/billing/tokens.ts:18-45`) + per-agent monthly ceiling `Agent.tokenLimit`/`periodTokensUsed` (`lib/billing/agent-tokens.ts`). Failure → `billing_limit`/`agent_limit`.
- **A currency (SAR) system exists** — `Wallet` + append-only `WalletTransaction` ledger (`schema.prisma:1917-1961`), `Subscription`/`Plan`/`Invoice` (Tap gateway, dunning). "Credits" = tokens bought with SAR via `purchaseTokenCredits()` (`lib/wallet.ts:160-206`); there is no independent credits ledger.
- **Per-agent SAR budget is prompt-only.** `Company/Agent.spendApprovalCapSar` is injected as a natural-language instruction to call `request_approval` (`lib/agent/prompt.ts:135-139`). **No code intercepts a spend and blocks it.** Same for `requireApprovalForSensitive`/`requireMessageReview` — LLM-obeyed guardrails, not enforced policy.
- **Approvals:** `Approval` model + `request_approval` tool + `/approvals` inbox — real HITL, but triggered by the model deciding to ask.
- **Audit is split, not unified.** `AuditLog` (`schema.prisma:1793`, human/security: userId, action, entity) and `TimelineEvent` (`schema.prisma:1574`, agent lifecycle) are separate models with no common actor abstraction.

### A.6 Modules, storefront, business objects
- **Modules** = Company booleans `hasEcommerce/hasServices/hasBookings` + derived `hasObjects` (`_count.objectTypes>0`); gate agent tools in `getToolsForCompany` (`tools.ts:52-60`).
- **Storefront** is **slug-based** (`app/(public)/[slug]/…`, resolved by `db.company.findUnique({where:{slug}})`). **Custom-domain fields exist but are NOT wired** — no host→tenant rewrite in `middleware.ts` or `next.config.ts`. Public chat widget streams via `/api/public/[slug]/chat` → `runPublicAgentChat`; **in-memory rate limit** (not multi-replica safe).
- **Business Objects** (`ObjectType`/`ObjectRecord`, `schema.prisma:2190,2214`) — owner-defined JSON-schema data types + generic agent tools (`query_records`/`create_record`/…). This is the real sector-generality lever.
- **Secrets:** one app-layer AES-256-GCM key (`ENCRYPTION_KEY`, `lib/encryption.ts`) protects all three secret columns (BYOK key, MCP token, Channel token). No external KMS/vault, no rotation.

**Bottom line:** BZNSS today is a solid **multi-tenant business suite with a competent single-turn tool-using agent runtime and a fragile-but-working autonomous task loop.** The provider abstraction, tool/permission gate, per-agent identity fields, pgvector memory, HITL approvals, and business-object generality are genuine assets. It is **not yet** an autonomous OS: there is no goal engine, no outcome metering, no enforced economics/policy plane, no real event bus, no unified audit, and tenant isolation + spend limits rest on discipline/prompts rather than enforcement.

---

## B. Gap Analysis (target component → today → gap)

| Target component | Today | Gap |
|---|---|---|
| **Agent Identity & Economics** (owned, permissioned, budgeted, expiring, revocable, metered) | `Agent` has tenant/manager/role/permissions/status/tokenLimit | **No** `ownerId`, `dataScope`, currency `budget`/`budgetPeriod`/per-action limit (enforced), `expiresAt`, or revoke lifecycle. Outcome metering absent. |
| **Agent Control Plane** (authz, data boundaries, financial limits, credentials, audit, revocation) | Scattered: `permissions[]`, `surface`, module gates, token budget, `Approval`, encrypted secrets | No unified policy engine; data scope = only `companyId`; SAR limits prompt-only; no credential broker; audit split; revocation = archive/pause only |
| **Tool Gateway / Capability Layer** (policy→budget→approval→credential-broker→provider→audit) | `executeTool` chokepoint + `getToolsForAgent` gate; tools hit DB directly | No pre-exec policy/budget/approval pipeline; no credential broker (agent tools run under ambient company scope); `Tool` registry minimal (no risk level/cost/data-classification/approval flags) |
| **Intelligence Gateway + Model Router** (provider-independent, task-aware routing) | Clean provider interface; static per-agent model | Managed=Vertex-only; **no router**; `isDefault` dead; embeddings Vertex-only |
| **Shared Business Memory / Business State** (5 layers, scope-filtered retrieval) | `AgentMemory` (vector) + `CompanyDNA` (blob) + relational tables | No operational-state snapshot; episodic history not retrievable; retrieval not data-scope-filtered; no recall threshold (a vector HNSW index already exists) |
| **Company Digital Twin** (Goals, Campaigns, Processes, Metrics, Policies, Documents…) | Company/Customer/Order/Booking/Product/Service/Agent/Task exist; `File`; `decisionPolicies` in DNA | **No Goals, Campaigns, Processes, Metrics models**; policies unstructured; no twin/state service |
| **Event Bus / Triggers** (rich catalog, async, explainable) | Synchronous `dispatchEvent`→Task; 5 events (2 dead) | No queue/async; thin catalog (missing booking.cancelled, invoice.overdue, payment.failed, campaign.performance_changed, goal.off_track, task.completed); no Trigger+Goal+Policy explainability |
| **Structured inter-agent delegation** (goal/context/deadline/budget/result/cost) | Bare `Task` + `dependsOn` | No structured delegation object; no deadline/budget/criteria/cost-attribution |
| **Goal Engine** (baseline/target/deadline/metrics/progress) | — | **Absent entirely.** Blocks "increase sales 20% in 90 days." |
| **Outcome Metering** (leads/qualified/attributed revenue/ROI per agent) | Only token/cost metering | **Absent.** Agents judged by task count/tokens, not business outcomes |
| **Autonomy Levels 0–5** (policy-enforced) | 3-level enum, prompt-obeyed | Coarser; not enforced by code; no per-tool/per-action risk mapping |
| **Manager Agent = planner/coordinator** | Maestro conductor builds/configures/delegates | Needs to become planning/monitoring-first (not a broad-tool super-agent); no plan/objective decomposition |
| **Unified activity log (human + AI)** | `AuditLog` + `TimelineEvent` separate | No common actor model; can't audit human+agent actions in one stream |
| **Secure Agent Workspace** (isolated browser/computer-use, vault credential injection, allowlists, evidence, auto-destroy) | — | **Absent.** Needs an abstraction (BZNSS consumes via interface; e.g. future "NX Secure Agent Workspace") |
| **Credits-abstracted customer economics** | Raw token Ints + SAR wallet; "credits" is wording | No first-class credits unit shielding customers from token math |

---

## C. Proposed Target Architecture

Keep BZNSS's business modules as the **operating environment**; add a thin set of **control/intelligence planes** around the existing agent runtime. Introduce components as *seams*, not rewrites.

1. **Control Plane** (new `lib/control/*`): the single authority for *may this actor do this action, on this data, within this budget, right now?* Wraps every side-effecting tool call. Sub-parts: Identity (extend `Agent`), Policy/Authz engine (data-scope + tool-scope + autonomy-level → allow/deny/needs-approval), Budget/Economics (enforced currency + token ledger), Approval router (reuse `Approval`), Credential Broker (fetch/inject secrets without exposing to the LLM), Audit sink (unified).
2. **Tool Gateway** (evolve `executeTool` into a pipeline): `Agent → resolve capability → Policy check → Budget check → Approval gate → Credential broker → provider/DB/MCP → meter cost+outcome → unified audit`. Back it with an enriched **Tool Registry** (`Tool` model + risk level, cost model, data classification, approval requirement, provider).
3. **Intelligence Gateway** (evolve `lib/ai/index.ts`): add a **Model Router** (task-class + tenant policy + cost/latency → provider/model), make embeddings provider-agnostic, activate `AiModel.isDefault`, keep the clean adapter interface.
4. **Business State / Memory service** (new `lib/state/*` + `lib/memory/*`): five typed layers — (1) structured source-of-truth (existing relational tables), (2) durable knowledge (`CompanyDNA` + FAQ + documents, embedded + chunked), (3) operational state (a derived, cached **Business State snapshot** + KPIs), (4) episodic (unified activity stream, embeddable), (5) agent learnings (`AgentMemory`, indexed + thresholded). Retrieval is **data-scope-filtered** by the caller's identity.
5. **Goal Engine** (new): `Goal → Strategy → Objective → Task`, each with baseline/target/deadline/metric/progress; drives the autonomous loop and Manager planning.
6. **Event Bus** (evolve `dispatchEvent`): a durable outbox/queue with a rich, versioned event catalog; every autonomous action carries `{trigger, goalId, policyId}` for explainability. (Start as a Postgres outbox table + the existing poller; swap the transport later without changing producers.)
7. **Outcome Metering** (new): attribute business results (leads, qualified, revenue, ROI) to agents/goals alongside cost metering, for the COO briefing and agent evaluation.
8. **Secure Agent Workspace abstraction** (new interface `lib/workspace/*`): a vendor-neutral contract for isolated browser/computer-use runtimes (ephemeral profile, vault credential injection, domain allowlist, network/file/clipboard policy, session logging, evidence, auto-destroy). BZNSS depends on the interface; a concrete runtime (e.g. "NX Secure Agent Workspace") plugs in later.
9. **Manager Agent** (evolve Maestro): planning/decomposition/delegation/monitoring; instantiates specialised agents from **Archetype templates** (already present, `lib/agent/archetypes.ts`); does not itself hold broad execution tools.

---

## D. Proposed Data Model (new / changed)

Additive and nullable-first (safe alongside existing tables). Names indicative.

**Agent Identity & Economics** — extend `Agent`: `ownerId` (FK User), `dataScope` (Json/enum policy), `budgetSar Decimal?`, `budgetPeriod` (enum), `perActionCapSar Decimal?`, `spentSarThisPeriod Decimal`, `expiresAt DateTime?`, `revokedAt DateTime?`, `runtimePolicy Json?`. New `AgentBudgetLedger` (append-only currency spend per agent, mirrors `WalletTransaction`).

**Goal Engine** — `Goal { companyId, ownerId, title, metricKey, baseline, target, unit, deadline, status, progress }`; `Objective { goalId, title, status, metricKey, target }`; link `Task.objectiveId?`, `Task.goalId?`.

**Structured delegation** — either extend `Task` (`goalId`, `objectiveId`, `deadline`, `budgetSar`, `successCriteria`, `requestingAgentId`, `resultCost`) or a `Delegation` join carrying the same. Promote `Task.triggerType` to an **enum**.

**Tool Registry enrichment** — extend `Tool`: `riskLevel` (enum), `costModel Json`, `dataClassification` (enum), `requiresApproval Boolean`, `provider`, `capabilitySchema`. New `CapabilityGrant { agentId, toolKey, dataScope, budget, expiresAt }` for scoped, expiring grants (beyond today's `permissions[]` string array).

**Unified activity** — `ActivityEvent { companyId, actorType (HUMAN|AGENT|SYSTEM), actorId, action, entityType, entityId, toolKey?, cost?, outcome?, ip?, metadata, at }`, superseding/unifying `AuditLog` + `TimelineEvent` (migrate both into it over time via a view/dual-write).

**Event Bus** — `EventOutbox { companyId, type, payload, status, availableAt, attempts }` + expanded `TriggerEvent` catalog; producers write to the outbox in the same transaction as the state change (transactional outbox pattern).

**Business State / Metrics** — `Metric { companyId, key, value, period, at }` (time series) + a cached `BusinessStateSnapshot` (or a materialized view) for the COO briefing. Chunked, embeddable `KnowledgeDoc` for durable knowledge RAG. Add a recall **similarity threshold** (a pgvector **HNSW** index already exists on `AgentMemory.embedding` via migration `20260621110000_agent_memory_hnsw` — no index work needed).

**Outcome Metering** — `OutcomeAttribution { companyId, agentId?, goalId?, kind (LEAD|QUALIFIED|REVENUE|…), value, sourceEntityId, at }`.

**Secure Workspace** — `WorkspaceSession { companyId, agentId, taskId, runtime, status, allowlist Json, startedAt, destroyedAt, evidenceRefs Json }` (metadata only; bytes live in the runtime/R2).

---

## E. Migration Strategy (evolve, don't disrupt)

Guiding rule: **the storefront, products, services, bookings, orders, customers, and existing chat must keep working unchanged at every step.** Everything below is additive.

1. **Seams before features.** Introduce the Control Plane / Tool Gateway as a *pass-through wrapper* around `executeTool` that initially only logs (unified `ActivityEvent`) and enforces nothing new — proving the chokepoint before adding policy/budget gates.
2. **Enforce what's already prompt-only.** Turn `spendApprovalCapSar` and `requireApprovalForSensitive` into real code gates in the gateway (deny/needs-approval), so today's soft guardrails become enforced without changing tool behavior on the happy path.
3. **Make RLS real, incrementally.** Adopt `withTenant()` in a small, high-risk surface first (agent tools, public routes), keeping the permissive-by-default policy so un-migrated code is unaffected; expand coverage; only later flip policies to deny-by-default once the GUC is set everywhere.
4. **Additive schema only.** New models + nullable columns; no destructive migrations. Dual-write `AuditLog`/`TimelineEvent` → `ActivityEvent`, then read from the unified stream, then deprecate.
5. **Event bus via outbox.** Add `EventOutbox` written in the same transaction as state changes; keep the existing poller as the first consumer. Swap transport (queue) later with zero producer changes.
6. **Goal Engine as an overlay.** Ship Goals/Objectives as data + Manager planning that *creates existing Tasks*; the autonomous loop already executes Tasks, so outcomes flow without a runtime rewrite.
7. **Model router behind the existing call.** Add routing inside `getProviderForModel`; default behavior unchanged until a routing policy is defined.

Never change production agent behavior, migrations, or the public storefront in the same PR as a control-plane seam; land seams dark (flagged), then enable per-tenant.

---

## F. Phase Plan (foundations first)

- **Phase 0 — Safety & seams (no new capabilities).** Unified `ActivityEvent` (dual-write); Tool Gateway pass-through wrapper around `executeTool`; enforce the *existing* SAR cap + sensitive-action approval in code; adopt `withTenant()` on agent-tool + public paths; add the `AgentMemory` recall **threshold** (HNSW index already exists); promote `Task.triggerType` to enum; wire the 2 dead events or remove them. *Outcome: the platform is safer and observable, behavior unchanged.*
- **Phase 1 — Identity & Economics.** Extend `Agent` (owner/dataScope/budgetSar/expiresAt/revoke) + `AgentBudgetLedger`; real currency budget enforcement + revocation lifecycle in the gateway; `CapabilityGrant` (scoped/expiring) alongside `permissions[]`.
- **Phase 2 — Intelligence Gateway.** Model Router (task-class + policy), activate `AiModel.isDefault`, provider-agnostic embeddings; keep managed default = Vertex but make switching a config, not code.
- **Phase 3 — Business State & Memory.** Business State snapshot + `Metric` time series; unified episodic memory; scope-filtered retrieval; chunked durable-knowledge RAG.
- **Phase 4 — Event Bus & structured delegation.** `EventOutbox` + expanded catalog + `{trigger,goalId,policyId}` on autonomous actions; structured delegation (deadline/budget/criteria/cost).
- **Phase 5 — Goal Engine & Outcome Metering.** Goals/Objectives, Manager planning/decomposition, outcome attribution + ROI; the COO briefing home ("how is my business doing").
- **Phase 6 — Secure Agent Workspace abstraction.** Interface + a first concrete runtime for browser/computer-use, vault credential injection, evidence, auto-destroy.

Resilience (promote the scheduler from in-process `setInterval` to a durable runner/queue) can slot in around Phase 3–4 when autonomous volume grows.

---

## G. Decisions Needed From You

1. **Isolation posture:** commit to making RLS real (deny-by-default eventually), or stay app-level with the Tool Gateway as the enforced boundary? (Affects how much of Phase 0 is mandatory.)
2. **Economics unit:** introduce a first-class **credit** the customer sees (abstracting tokens), or keep SAR-wallet + token Ints? And should per-agent **currency budgets** be hard-enforced (recommended) from Phase 1?
3. **Managed vs BYOK vs self-hosted** default going forward, and which providers to certify in the router (cost/privacy/sovereignty priorities).
4. **Autonomy taxonomy:** adopt the 0–5 levels (mapped to enforced policy) or keep/extend the 3-level `AutonomyLevel`? Per-tool risk classification who-owns.
5. **Secure Workspace build-vs-buy:** target vendor(s) for the first browser/computer-use runtime behind the abstraction.
6. **Scheduler infrastructure:** are we willing to add a durable queue/runner (Redis/pg-boss/managed) when volume grows, or must it stay Postgres-only?
7. **Goal metrics source of truth:** which KPIs are authoritative (revenue from Orders? external analytics/ads?) — drives the Metric/attribution model.

## H. Risks

- **Cross-tenant exposure (HIGH):** isolation is developer-discipline only; RLS is inert; a single missing `where:{companyId}` leaks data. *Mitigate:* Tool Gateway scope-injection + make `withTenant()` real.
- **Cost explosion (HIGH):** autonomous event→task→delegate fan-out has no global budget/loop bound (only per-turn `MAX_TOOL_ROUNDS=5` and per-task token caps). Delegation cycles or an event storm can spawn many billed tasks. *Mitigate:* per-goal/per-period budgets, delegation depth/quota caps, enforced currency ledger.
- **Spend/privilege escalation (HIGH):** SAR caps + sensitive-action + message-review guardrails are **prompt-only**; a model that ignores them acts unchecked. *Mitigate:* code-enforce in the gateway.
- **Duplicate / irreversible actions (MED-HIGH):** side-effecting tools (`create_order`, `create_booking`) lack idempotency keys; the stuck-task reaper re-runs tasks that may already have acted. *Mitigate:* idempotency keys + effect ledger; classify irreversibility → force approval.
- **Credential blast radius (MED):** one symmetric `ENCRYPTION_KEY` guards all secrets, no rotation/KMS; secrets currently decrypted in-process. *Mitigate:* credential broker + KMS + never expose secrets to the LLM (already the intent for MCP).
- **Scheduler fragility (MED):** in-process `setInterval`, off unless `CRON_SELF=1`, wall-clock drift, silent stop on container replace; inconsistent entry points. *Mitigate:* durable runner + alerting on the existing heartbeat.
- **Hallucination / bad autonomous decisions (MED):** naive RAG (no similarity threshold; the vector index itself already exists) injects irrelevant memories; goals/metrics absent so agents optimize proxies. *Mitigate:* thresholded scope-filtered retrieval + Goal/outcome grounding + HITL on high-risk.
- **Multi-replica correctness (LOW-MED):** public-chat rate limit is in-memory; fine today, wrong under horizontal scale.
- **Scalability:** the Postgres-polling scheduler and synchronous event fan-out are fine now, cliffs later. (pgvector recall is already HNSW-indexed.)

## I. My Critique (where I'd push back or go further)

1. **Fix enforcement before adding autonomy.** The single most important finding is that your *safety* primitives — tenant isolation and spend/permission guardrails — are **advisory, not enforced** (RLS inert; SAR cap and sensitive-action gates are prompt strings). Building more autonomy on top of advisory controls multiplies blast radius. I'd make Phase 0 non-negotiable and precede all Goal-Engine work.
2. **The Tool Gateway is the highest-leverage seam — and you already have it.** `executeTool` is a genuine single chokepoint. Evolving *that one function* into policy→budget→approval→broker→audit gets you 80% of the Control Plane without touching agent logic. Don't build a separate microservice; harden the chokepoint.
3. **Don't over-model the org chart.** You already learned (departments/roles) that rigid structure confuses owners. Keep Goals + outcomes as the spine and let the Manager instantiate agents from archetypes on demand; treat departments as tags, not required scaffolding.
4. **"Credits" should be real, or drop the word.** Today it's marketing over raw token Ints. Either introduce a first-class credit unit (recommended for customer clarity + provider independence) or stop calling it credits. Currency budgets per agent must be enforced ledgers, not prompt hints.
5. **Idempotency is a correctness prerequisite, not a nice-to-have.** The moment agents act autonomously and tasks get reaped/retried, non-idempotent side-effecting tools will double-charge, double-book, double-order. Add idempotency keys + an effect ledger in Phase 0/1, not later.
6. **Event bus: use a transactional outbox, not a queue-first rewrite.** Given a Postgres-centric stack with no Redis, an outbox table written in the same transaction as the state change (consumed by your existing poller) buys durability + async + explainability with minimal new infra, and lets you swap transport later. Avoid introducing Kafka/etc. prematurely.
7. **Embeddings abstraction is a real gap.** Chat is provider-agnostic but memory is silently Vertex-only, so any non-Vertex deployment loses semantic memory with no signal. If provider independence is a product promise, embeddings must route too.
8. **Manager-as-super-agent is the failure mode to avoid — and your current Maestro trends toward it** (it holds broad read/act tools plus building powers). I'd narrow the Manager to plan/delegate/monitor and push execution to specialised, budgeted, expiring agents. This also makes outcome attribution meaningful.
9. **Secure Workspace: keep it an interface for a long time.** Don't let any browser vendor's model leak into BZNSS. The abstraction (allowlist, vault injection, evidence, auto-destroy) is right; resist building the runtime inside BZNSS.

---

*Prepared as a read-only assessment. Recommended first action: review Phase 0 together and decide the isolation + economics-enforcement posture (Decisions 1–2) before any implementation.*
