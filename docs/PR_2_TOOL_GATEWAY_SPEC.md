# PR-2 Technical Specification — Tool Gateway (pass-through)

**Status:** DESIGN ONLY. No code. PR-2 is **observational/pass-through** — it establishes the execution seam and begins gateway telemetry; it activates **no enforcement**. Current `executeTool` behavior stays functionally identical.
**Builds on:** PR-1 (`ActivityEvent` + `ActivitySource.GATEWAY` reserved). **Does not** start the queued Agent-Intelligence-Reliability work (see `docs/TECH_DEBT.md` TD-2).

---

## 1. Exact current tool-execution architecture
- Single dispatch chokepoint: `executeTool(name, rawArgs, ctx: ToolContext): Promise<string>` — `lib/agent/tools.ts:974`. `ToolContext = { companyId, agentId }` — `tools.ts:22`. MCP third-party tools dispatch **inside** it: `if (isMcpTool(name)) return await callMcpTool(...)` — `tools.ts:982`. Built-ins are a private `switch(name)`; individual handlers are **not exported** (so they can't be invoked directly).
- The only invokers are the two loop functions in `lib/agent/core.ts`: `runToolLoop` (call site `core.ts:141`) and `runToolLoopStream` (call site `core.ts:202`; it also falls back to `runToolLoop` at `core.ts:165`). Loop input is `ToolLoopArgs` (`core.ts:76`) carrying `ctx: ToolContext` (`core.ts:87`), tools (from `getToolsForAgent`, `tools.ts:83`), model, `streamFinalOnly` (`core.ts:101`), etc. Round cap `MAX_TOOL_ROUNDS = 5` (`core.ts:11`).
- Result contract: every tool returns a JSON **string** via `ok()`/`fail()` (`tools.ts:632/635`); errors are caught **inside** `executeTool` (`tools.ts` trailing `try/catch` → `fail('تعذّر تنفيذ الأداة.')`), so the loop always receives a string, never a throw.

## 2. Every current caller of `executeTool` (the funnel)
`executeTool` is reached **only** through `runToolLoop`/`runToolLoopStream`. Those two are called from exactly four entry points:

| Entry point | File:line | Surface / audience | executionId source |
|---|---|---|---|
| Dashboard chat (incl. Maestro/conductor) | `lib/agent/run.ts:175-176` | internal, owner | generated per loop run |
| Public storefront / widget / channels | `lib/agent/public-chat.ts:196-197` | customer (`surface==='INTERNAL'` rejected `public-chat.ts:99`; `PUBLIC_ALLOWLIST` `:151-167`; `streamFinalOnly:true` `:188`; `ctx:{companyId,agentId}` `:189`) | generated per loop run |
| Scheduled / autonomous / delegated tasks | `lib/agent/task.ts:127` | internal, system/agent | **reuse `TaskAttempt.id`** (`task.ts:89`, `attemptNumber` `:87-88`) |
| Sandbox / test | `lib/agent/sandbox.ts:83` | internal, owner (no persistence) | generated per loop run |

**Because all four converge on `core.ts:141/202`, wrapping there covers every path with one change** — chat, Maestro, public, tasks, delegation, sandbox — with no per-entry-point edits to the execution call itself (entry points only supply lineage metadata; see §6).

## 3. Bypass paths (back-door analysis)
**No agent-tool execution bypasses `executeTool`.** Handlers aren't exported; MCP goes through `executeTool`→`callMcpTool`. Verified: the only `executeTool` references are `core.ts:141`, `core.ts:202`, and its definition (`tools.ts:974`) (grep `executeTool` across `lib/ app/ scripts/`).
Direct DB mutations that are **not** agent-tool calls (so out of PR-2 scope, not back doors): the customer storefront actions `app/api/public/[slug]/{order,book,slots,review}/route.ts` (a human customer acting, not an agent), owner server actions in `lib/actions/*` (owner UI; super-admin ones already audited via `lib/actions/admin.ts:79-81`), and scheduler/event plumbing (`lib/agent/events.ts` `dispatchEvent`, `lib/agent/scheduler.ts`) which create `Task`/`TimelineEvent` rows. These are deliberately outside the agent Tool Gateway; PR-1's dual-write already captures their `TimelineEvent`/`AuditLog` footprint.

## 4. Proposed Tool Gateway API/interface
New module `lib/agent/gateway.ts`:
```ts
export interface ExecutionMeta {         // lineage supplied by the entry point
  executionId: string;
  actorType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  surface: 'internal' | 'customer';
  ownerId?: string; goalId?: string; taskId?: string; sessionId?: string;
  autonomy?: 'SUGGEST' | 'ASK' | 'AUTOPILOT';
}
// The ONLY change at the call sites: core.ts calls this instead of executeTool.
export async function runToolThroughGateway(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,          // unchanged {companyId, agentId}
  meta: ExecutionMeta,
): Promise<string>;          // returns the SAME string executeTool returns
```
Internally: `buildContract()` → (PR-6+ enforcement stages inserted here, **absent in PR-2**) → `const t0=Date.now(); result = await executeTool(name,args,ctx)` → capture outcome+duration → `recordGatewayActivity()` (best-effort) → `return result`. `executeTool`'s signature and body are **unchanged**.

## 5. Proposed Execution Contract (TypeScript)
```ts
export interface ExecutionContract {
  executionId: string;                 // per loop-run (§6)
  contractId: string;                  // per tool invocation (uuid)
  companyId: string;                   // tenant
  actorType: 'HUMAN' | 'AGENT' | 'SYSTEM';
  agentId: string;
  ownerId?: string;                    // where known
  goalId?: string; taskId?: string; sessionId?: string;   // lineage, where known
  capability: string;                  // == tool name
  argsRef: { keys: string[]; count: number };  // redacted reference, NOT raw args (§9)
  resource?: { type: string; id?: string };    // where derivable (best-effort)
  surface: 'internal' | 'customer';
  autonomy?: 'SUGGEST' | 'ASK' | 'AUTOPILOT';  // advisory context
  risk?: undefined;                    // placeholder (PR-6)
  estCost?: undefined;                 // placeholder (economics PR)
  approvalRef?: undefined;             // placeholder (approval PR)
  idempotencyRef?: undefined;          // placeholder (idempotency PR)
  startedAt: string; finishedAt?: string;
  outcome?: 'success' | 'error'; errorClass?: string; durationMs?: number;
}
```
Policy/economic fields stay `undefined`/advisory in PR-2 — **no faked data**.

## 6. executionId / contractId lifecycle — and §7 answer
- **executionId** = one *execution instance* = one `runToolLoop(Stream)` run (one attempt/turn of work). Generated once at the top of the loop and threaded via `ExecutionMeta` to every tool invocation in that run. **For task-originated runs, reuse `TaskAttempt.id`** (`task.ts:89`) as the executionId — it already *is* the durable per-attempt execution record. Chat/sandbox runs use a generated uuid (their turn is already persisted as `ChatMessage`/nothing).
- **contractId** = one per tool invocation (uuid), sharing the run's executionId.
- Lineage realized: `task → TaskAttempt(executionId) → tool action(contractId) → ActivityEvent(executionId,contractId)` — enough for the gateway layer, **no workflow engine**.

## 7. Does PR-2 need a DB `AgentExecution` model? — **No.**
Prefer the simpler solution: a **runtime-carried executionId** (reusing `TaskAttempt.id` for tasks) is sufficient for correctness in an observational PR. `ActivityEvent.executionId` (added in PR-1) already persists the linkage. A dedicated mutable `AgentExecution` table adds a write per run and durable state we don't yet consume — **defer** it to the phase that needs cross-run execution state (e.g., budgets/outcome attribution). **Decision: no new model in PR-2.**

## 8. ActivityEvent integration — and the "how many events" challenge
**Recommendation (challenging the start/result assumption): write ONE terminal `ActivityEvent` (`source: GATEWAY`) per *material* tool invocation, on completion/failure — not a start event, not per read.**
- Fields: `source=GATEWAY`, `actorType`, `actorId=agentId`, `action=<capability>`, `executionId`, `taskId`/`sessionId`, `contractId`, `outcome`('success'|'error'), `decision=null` (PR-2 has no policy decision), `metadata={durationMs, resultSize, errorClass, argKeys, resourceRef}`, `occurredAt=startedAt`, `recordedAt=now`.
- **Reads excluded by default.** A static `MATERIAL_CAPABILITIES` set (the mutating tools: `create_order, create_booking, update_booking, create_lead, update_lead, create_order, create_task, update_task_status, create_output, delegate_to_agent, create_record, update_record, create_agent, configure_agent, set_booking_staff, request_approval, save_memory`, plus any `mcp__*` since side effects are opaque) is logged; pure reads (`search_catalog, search_faq, find_customer, list_customers, list_bookings, list_open_slots, check_availability, list_agents, list_outputs, list_object_types, query_records`) are **not** logged (flag can enable sampling later). No capability registry needed yet — a `const` set suffices (PR-6 replaces it).
- **Why not two events (requested+completed):** doubles volume and adds a "requested" row that's rarely actionable for sub-second tool calls; a single terminal row carries outcome+duration. If in-flight visibility is later needed, add a requested event then — not now.
- **Why not a dedicated execution record instead of ActivityEvent:** ActivityEvent already exists, is append-only, and is the unified stream; reusing it (source=GATEWAY, one row per material action) avoids a second store. Keep ActivityEvent append-only; do **not** mutate rows.
- **De-dup note:** some material tools already emit a `TimelineEvent` (→ dual-written as `source=TIMELINE`, e.g. `create_output`→OUTPUT_DELIVERED, `delegate_to_agent`→AGENT_HANDOFF, `create_agent`→AGENT_MESSAGE). The GATEWAY row is a *different grain* (tool-execution + duration + outcome) than the TIMELINE row (business lifecycle). They coexist distinguished by `source`; acceptable and useful. If later judged redundant, the material set can exclude tools that already timeline-log.

## 9. Sanitization / redaction (lightweight — not a DLP subsystem)
Current args/results DO carry sensitive data: `create_lead`/`find_customer`/`create_order` (phone/email/name/PII), `save_memory`/`create_output` (free text, possibly large), `mcp__*` (opaque — could contain tokens/external API bodies), read results like `list_customers` (names+phones). So **PR-2 never stores raw args or raw results.** Instead a minimal redacted envelope:
- **Store fully:** capability name, `outcome`, `durationMs`, `resultSize` (char count), `errorClass`, `argKeys` (key names only), `resource.type`/`id` when trivially derivable.
- **Redact completely (never store the value):** any arg whose key matches `/pass|secret|token|key|auth|otp|cvv|card|iban|credential/i`; all values under `mcp__*` tools (opaque).
- **Mask/omit (PII):** phone/email/name values → omitted (keys still recorded); no PII values in the stream.
- **Never store:** passwords, API keys, tokens, auth headers, payment data, uploaded file bytes, external API response bodies, full `create_output.body` (store title + length only).
- **Caps:** any incidentally-stored string truncated to 512 chars; `metadata` JSON capped (e.g. ≤2 KB).
Helper: `redactForActivity(name, args, resultMeta)` in `lib/agent/gateway.ts` (or `lib/agent/redact.ts`). This is intentionally small — a key-denylist + caps + MCP-opaque rule, **not** content scanning/DLP.

## 10. Success / error lifecycle
- **Tool success:** gateway returns `executeTool`'s exact string; writes one GATEWAY ActivityEvent (`outcome:'success'`) for material capabilities.
- **Tool error:** `executeTool` already returns a `fail(...)` string (it catches internally); the gateway passes it through **unchanged** and records `outcome:'error'` + `errorClass` (parsed from the fail payload — never raw sensitive detail). The gateway never converts behavior.
- **No new terminal states**; PR-2 does not add PENDING/approval outcomes (enforcement era).

## 11. Pass-through compatibility approach
The only behavioral surface is the **string returned to the model** — unchanged, because the gateway returns `executeTool`'s output verbatim. Preserved: tool names, arg schemas, results to the LLM, `getToolsForAgent` permission behavior (`tools.ts:83`), prompts, task behavior, and customer-facing behavior. Entry points change **only** to supply `ExecutionMeta`; `executeTool`'s signature/body are untouched.

## 12. Gateway instrumentation-failure semantics (fail-open, like PR-1)
- Building the contract / redaction throwing → caught, `console.warn`, **tool still runs**.
- ActivityEvent write failing → caught, `console.warn('[gateway] activity write failed', {executionId, capability, err})`, **never affects the tool result or the business op** (mirrors PR-1's DB-trigger fail-open, refinement 1).
- **No fail-closed anywhere in PR-2.** (Fail-closed arrives only with the enforcement stages, later.)
- **Timeouts:** **non-goal** — PR-2 adds none; current MCP/tool timing behavior is preserved.

## 13. Expected DB-write / latency overhead
- Flag **off:** zero — `core.ts` calls `executeTool` exactly as today.
- Flag **on:** **+1 INSERT only for *material* tool invocations** (reads add zero DB writes). A typical chat turn issues mostly reads → often **0** extra writes; a build/mutate action → 1 small insert. The insert is best-effort and its ~1–5 ms is dominated by the multi-second model round-trip. To guarantee no added user-perceived latency, the write is issued **after the tool result is captured** and **not awaited on the path that returns the result to the loop** (fire-and-forget with a caught promise), or awaited-but-non-fatal if strict ordering is preferred (flag). Net: negligible; proportional to *meaningful* actions, not read chatter.

## 14. Feature flag / rollout
- Flag `TOOL_GATEWAY` — env (`TOOL_GATEWAY_ENABLED`) and/or a `PlatformSettings` field for per-tenant. **Off by default.** Off → bypass wrapper entirely (call `executeTool` directly). On → wrap + log-only.
- Rollout: land dark → enable on a demo tenant (`refine`/`khedmatak`) → verify GATEWAY rows accrue for material actions with correct redaction → enable broadly. No user-visible change at any step.

## 15. Tests
- **Unit (`lib/agent/gateway.test.ts`):** pass-through returns byte-identical result to a stubbed `executeTool`; telemetry-failure is fail-open (tool result still returned); `redactForActivity` drops denylisted keys, masks PII, caps sizes, treats `mcp__*` opaque; material-vs-read classification; contract built with correct lineage.
- **Integration (extend `lib/activity/activity-event.test.ts`, env-guarded):** a material tool invocation writes exactly one `source=GATEWAY` ActivityEvent with `executionId/capability/outcome/durationMs`; a read writes none; a forced telemetry failure doesn't break the tool.
- **No-bypass guard:** a test asserting `core.ts` routes through the gateway (and a grep-style check that `executeTool` has no callers other than the gateway + its def).
- **Public-surface leak test:** a customer-path tool call produces server-side GATEWAY telemetry but the SSE response to the customer is unchanged (no tool names/metadata/internal errors).

## 16. Exact files expected to change
- **NEW** `lib/agent/gateway.ts` (+ optional `lib/agent/redact.ts`).
- `lib/agent/core.ts` — replace the two `executeTool(...)` calls (`:141`, `:202`) with `runToolThroughGateway(...)`; extend `ToolLoopArgs` (`:76`) with `meta?: ExecutionMeta`; generate/thread `executionId`.
- Entry points populate `ExecutionMeta`: `lib/agent/run.ts` (~`:175`), `lib/agent/public-chat.ts` (~`:196`), `lib/agent/task.ts` (~`:127`, reuse `TaskAttempt.id`), `lib/agent/sandbox.ts` (~`:83`).
- **NEW** tests (§15). Optional flag field in `prisma/schema.prisma` `PlatformSettings` **only if** per-tenant is wanted (else env-only → no schema change).
- **NO change** to `lib/agent/tools.ts` `executeTool`, tool names/schemas, `getToolsForAgent`, prompts, or `ActivityEvent` schema (PR-1 columns suffice).

## 17. Acceptance criteria
1. Flag off → behavior byte-identical (no extra writes, no latency); CI green.
2. Flag on → material tool calls produce exactly one `source=GATEWAY` ActivityEvent with correct `executionId`, `capability`, `outcome`, `durationMs`; reads produce none.
3. Tool results returned to the LLM are unchanged for every tool (pass-through).
4. Telemetry/instrumentation failure never turns a successful tool into a failure.
5. Customer-facing responses unchanged; no tool names/args/metadata/internal errors leak to the storefront.
6. No secrets/PII/payment/file/MCP-opaque data stored in ActivityEvent.
7. No new agent abilities; permissions/prompts/tasks unchanged. `tsc` + full suite green.

## 18. Rollback strategy
Flag off → instant revert to direct `executeTool` (zero effect). Additive code + (optional) additive column → a clean PR revert with no data migration. ActivityEvent GATEWAY rows are inert history.

## 19. Explicit non-goals (must NOT appear in PR-2)
Enforcement stages (tenantAssert, capability policy, autonomy levels, budgets, approvals, idempotency, credential broker) — **absent/inactive**; `AgentExecution` DB model; timeouts; DLP/content scanning; a capability registry; any read-surface consuming ActivityEvent; changes to tool names/args/results/prompts/permissions; workflow engine; the queued Agent-Intelligence-Reliability work (TD-2).

## 20. Over-engineering flags → simpler alternative
| Tempting | Simpler PR-2 choice |
|---|---|
| `AgentExecution` DB model now | Runtime `executionId` (reuse `TaskAttempt.id` for tasks); persist only on `ActivityEvent.executionId` |
| Start + completed events per tool | One terminal event per **material** action |
| Log every tool call incl. reads | Material-only by default (`const` set); reads off/sampled |
| Full arg/result capture + DLP | Minimal redacted envelope (keys, sizes, outcome); MCP opaque |
| Capability registry for classification | A `const MATERIAL_CAPABILITIES` set (PR-6 replaces it) |
| New `GatewayContext` type everywhere | Extend `ToolLoopArgs` with one optional `meta` object |
| Synchronous awaited audit on hot path | Best-effort, non-blocking write; proportional to material actions |

---

*Design only. No code, no migration. Awaiting review before implementing PR-2. Enforcement stays for later PRs; the Agent-Intelligence-Reliability issue remains queued (TD-2) and untouched.*
