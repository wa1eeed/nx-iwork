# PR-2 Technical Specification — Tool Gateway (pass-through) — REV 2

**Status:** DESIGN ONLY. No code. PR-2 is **observational/pass-through**: it establishes a **permanent** execution seam and writes minimal per-invocation telemetry. It activates **no enforcement**. `executeTool` behavior stays functionally identical.
**Rev 2** incorporates the 7 mandatory refinements: permanent chokepoint; log **every** invocation (incl. reads) with an `effect` class; **actor vs initiator** separation; deterministic `executionId` ownership; `source=GATEWAY,sourceId=contractId` idempotent identity; **awaited fail-open** telemetry (no fire-and-forget); structural-metadata-only (no titles/snippets/raw args/results); env-flag gates telemetry **write only** (gateway path unconditional; no schema change).
**Builds on:** PR-1 (`ActivityEvent` + reserved `ActivitySource.GATEWAY` + `@@unique([source, sourceId])`). Does **not** start TD-2 (Agent-Intelligence-Reliability).

---

## 1. Exact current tool-execution architecture
- Single dispatch chokepoint: `executeTool(name, rawArgs, ctx): Promise<string>` — `lib/agent/tools.ts:974`. `ToolContext = { companyId, agentId }` — `tools.ts:22`. MCP dispatches inside it — `tools.ts:982` (`callMcpTool`, which returns the same `{ok,...}` envelope — `lib/mcp/registry.ts:86`). Built-in handlers are a private `switch`; not individually exported.
- Only invokers: `runToolLoop` (`core.ts:141`) and `runToolLoopStream` (`core.ts:202`, plus its fallback to `runToolLoop` at `core.ts:165`). `ToolLoopArgs` at `core.ts:76` carries `ctx` (`core.ts:87`). Round cap `MAX_TOOL_ROUNDS=5` (`core.ts:11`).
- Every tool returns a JSON **string** via `ok()`/`fail()` (`tools.ts:632/635`); errors are caught inside `executeTool`, so the loop always gets a string.

## 2. Every current caller of `executeTool` (the funnel)
Reached **only** via `runToolLoop`/`runToolLoopStream`, called from four entry points:

| Entry point | File:line | actor / surface | initiator | executionId |
|---|---|---|---|---|
| Dashboard chat (incl. Maestro) | `lib/agent/run.ts:175-176` | AGENT / internal | HUMAN (dashboard user) | generated before loop |
| Public storefront/widget/channels | `lib/agent/public-chat.ts:196-197` | AGENT / customer | CUSTOMER (identity usually absent) | generated before loop |
| Scheduled/autonomous/delegated tasks | `lib/agent/task.ts:127` | AGENT / internal | SYSTEM (or delegating agent) | **`TaskAttempt.id`** |
| Sandbox/test | `lib/agent/sandbox.ts:83` | AGENT / internal | HUMAN (owner) | generated before loop |

All four converge on `core.ts:141/202` → wrapping there covers every path with one change.

## 3. Bypass paths (back-door analysis)
**No agent-tool execution bypasses `executeTool`** (handlers unexported; MCP via `executeTool`→`callMcpTool`; grep shows the only refs are `core.ts:141`, `core.ts:202`, def `tools.ts:974`). Non-agent DB writers out of scope: customer storefront routes `app/api/public/[slug]/{order,book,slots,review}`, owner server actions `lib/actions/*` (super-admin already audited `lib/actions/admin.ts:79-81`), scheduler/event plumbing (`lib/agent/events.ts`, `lib/agent/scheduler.ts`). PR-1 dual-write already captures their `TimelineEvent`/`AuditLog` footprint.
**After PR-2, `executeTool` must have exactly one production caller: the gateway** (§17 acceptance).

## 4. Gateway API — a PERMANENT chokepoint (Refinement 1)
New module `lib/agent/gateway.ts`. **`core.ts` always calls the gateway; it never calls `executeTool` directly again.** The env flag toggles the telemetry **write** only — it must **never** bypass the gateway (future enforcement lives inside this seam).
```ts
export type Effect = 'READ' | 'WRITE' | 'EXTERNAL' | 'UNKNOWN';
export type InitiatorType = 'HUMAN' | 'SYSTEM' | 'CUSTOMER';

export interface ExecutionMeta {          // supplied by the entry point, threaded unchanged
  executionId: string;                    // generated once per run (or TaskAttempt.id)
  surface: 'internal' | 'customer';
  initiator: { type: InitiatorType; userId?: string };  // userId only when reliably known
  goalId?: string; taskId?: string; sessionId?: string;
  autonomy?: 'SUGGEST' | 'ASK' | 'AUTOPILOT';
}

// The ONLY execution call in core.ts, in both loop functions.
export async function runToolThroughGateway(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,        // unchanged {companyId, agentId}
  meta: ExecutionMeta,
): Promise<string>;        // returns the EXACT string executeTool returns
```
Internal flow (always): build contract → *[PR-6+ enforcement inserts here — absent in PR-2]* → `const t0=Date.now(); const result = await executeTool(name,args,ctx); const durationMs=Date.now()-t0;` → parse outcome → **`try { await recordGatewayActivity(...) } catch { warn }`** (Refinement 6) → `return result`. When telemetry flag is off, the `recordGatewayActivity` step is skipped but the wrapper + `executeTool` call are unchanged.

## 5. Execution Contract (TypeScript) — actor vs initiator (Refinement 3)
```ts
export interface ExecutionContract {
  executionId: string;                 // per run (§6)
  contractId: string;                  // per invocation (uuid) — authoritative internal id
  toolCallId?: string;                 // optional provider correlation (advisory)
  companyId: string;                   // tenant

  // The ACTOR is always the agent for a gateway call — it executed the tool.
  actorType: 'AGENT';
  agentId: string;
  // The INITIATOR is who caused the run — a human/scheduler/customer — NOT the executor.
  initiator: { type: 'HUMAN' | 'SYSTEM' | 'CUSTOMER'; userId?: string };

  capability: string;                  // == tool name
  effect: 'READ' | 'WRITE' | 'EXTERNAL' | 'UNKNOWN';
  argKeys: string[];                   // key NAMES only (never values)
  resource?: { type: string; id?: string };  // ONLY if explicitly & reliably derived
  surface: 'internal' | 'customer';
  goalId?: string; taskId?: string; sessionId?: string;
  autonomy?: 'SUGGEST' | 'ASK' | 'AUTOPILOT';  // advisory

  // placeholders (later PRs) — stay undefined in PR-2, never faked
  risk?: undefined; estCost?: undefined; approvalRef?: undefined; idempotencyRef?: undefined;

  startedAt: string; finishedAt?: string; durationMs?: number;
  outcome?: 'success' | 'error'; errorClass?: string;  // generic code, never the message
  resultSize?: number;                 // chars of the returned string
}
```
For **all** current gateway calls `actorType='AGENT'`, `actorId=ctx.agentId`. Initiator is stored separately (in `ActivityEvent.metadata`) when reliably known; a dashboard user is `{HUMAN,userId}`, a scheduler is `{SYSTEM}`, a delegating agent is `{SYSTEM}` (or a later delegation ref), a public customer is `{CUSTOMER}` with **no userId** (identity not reliably available — `surface=customer` suffices). **Never manufacture an initiator the runtime can't prove.** Renamed the ambiguous `ownerId` → `initiator.userId` (a.k.a. `initiatorUserId`).

## 6. executionId / contractId lifecycle — deterministic (Refinement 4)
- **The entry point generates `executionId` once, before entering the loop**, and passes it in `ExecutionMeta`:
  - dashboard chat (`run.ts`), public chat (`public-chat.ts`), sandbox (`sandbox.ts`) → a generated uuid;
  - task execution (`task.ts`) → **the actual `TaskAttempt.id`**.
- **Known code change (no schema change):** `task.ts:89` currently does `await db.taskAttempt.create({ data: {...} })` **without capturing the id**. PR-2 changes it to `const attempt = await db.taskAttempt.create({ data:{...}, select:{ id:true } })` and uses `attempt.id` as `executionId`.
- **Stable across streaming fallback:** `runToolLoopStream` (`core.ts:159`) falls back to `runToolLoop` (`core.ts:165`) — it must pass the **same `ExecutionMeta`** (same `executionId`), never regenerate. `executionId` lives in `ToolLoopArgs`, not created inside the loop.
- **contractId** = one uuid per tool invocation, generated inside the gateway. Optional provider `toolCallId` (from the model's tool-call) carried as advisory correlation; **`contractId` is the authoritative internal invocation id.**
- Lineage: `task → TaskAttempt(executionId) → tool invocation(contractId) → ActivityEvent(executionId, contractId)`. No workflow engine.

## 7. DB `AgentExecution` model? — **No** (unchanged)
Runtime `executionId` (reusing `TaskAttempt.id` for tasks) is sufficient; linkage persists on `ActivityEvent.executionId` (PR-1). Defer a dedicated table to the phase that needs cross-run execution state. No new model in PR-2.

## 8. ActivityEvent integration — log EVERY invocation (Refinements 2 & 5)
**One terminal `ActivityEvent` per tool invocation — including reads.** This is foundational observability (e.g. to later prove an agent actually called `list_agents`/`list_customers`/`list_outputs`/`query_records` before asserting a business fact). It is **not** Agent-Intelligence-Reliability work — it only builds the data.
- **Identity (idempotent):** `source='GATEWAY'`, `sourceId=contractId`, and `metadata.contractId=contractId`. This reuses PR-1's `@@unique([source, sourceId])` so a retried telemetry write cannot create a duplicate GATEWAY row. **No ActivityEvent schema change.**
- **Row shape:** `actorType='AGENT'`, `actorId=agentId`, `action=<capability>`, `occurredAt=startedAt`, `recordedAt=now`, `decision=null` (no policy in PR-2), `taskId`/`sessionId` when known, `executionId`.
- **`metadata` (structural only):** `{ effect, argKeys, resultSize, durationMs, outcome, errorClass?, initiator?: {type,userId?}, toolCallId?, resource?: {type,id} }`. **No `summary`, no titles, no names, no snippets, no raw args, no raw results, no error messages.**
- **`effect` classification (small static map, not a registry):**
  - `READ`: search_catalog, search_faq, find_customer, list_customers, list_bookings, list_open_slots, check_availability, list_agents, list_outputs, list_object_types, query_records
  - `WRITE`: create_lead, update_lead, create_order, create_booking, update_booking, set_booking_staff, create_task, update_task_status, create_output, delegate_to_agent, create_record, update_record, create_agent, configure_agent, save_memory, request_approval
  - `EXTERNAL`: any `mcp__*` tool (calls a third-party provider)
  - `UNKNOWN`: default for anything unmapped
- **Deterministic outcome parser:** the returned string is the `{ok:boolean,...}` envelope (built-ins `tools.ts:632/635`; MCP `registry.ts:86`). Parse JSON: `ok===false` → `outcome='error'`, `errorClass` = a **safe generic code** (e.g. the envelope's known error slug mapped to a small allow-list, else `'tool_error'`) — **never the raw error string**; otherwise `outcome='success'`. Unparseable/non-envelope → `outcome='success'` (a string was returned) with `errorClass` unset. `resultSize` = returned string length.

## 9. Sanitization / redaction — minimize further (Refinement 7)
PR-2 stores **only structural metadata** (§8): capability, effect, argKeys (names only), resultSize, outcome, durationMs, executionId, contractId, task/session lineage, surface, initiator (type + userId only when reliable), and a `resource {type,id}` **only when explicitly and reliably derivable** from a known id-typed argument (e.g. an arg literally named `recordId`/`bookingId`/`customerId` that the system set) — **never inferred from arbitrary/free text**. This removes almost all of the redaction problem: no raw args, no raw results, no user-supplied titles/snippets/names, no error messages, no MCP payloads. `argKeys` is the arg object's top-level key names (safe); MCP arg values are never stored (effect=EXTERNAL, opaque). A tiny helper `structuralMeta(name, args, resultString)` produces this envelope. **Not a DLP subsystem.**

## 10. Success / error lifecycle
- **Success:** gateway returns `executeTool`'s exact string; writes one GATEWAY event `outcome='success'`.
- **Error:** `executeTool` already returns a `fail(...)` string; gateway passes it through **unchanged** and records `outcome='error'` + a generic `errorClass` (no message). No behavior change; no new terminal states.

## 11. Pass-through compatibility
Only surface is the string returned to the model — unchanged (verbatim). Preserved: tool names, arg schemas, results to the LLM, `getToolsForAgent` permissions (`tools.ts:83`), prompts, task behavior, customer-facing behavior. Entry points change only to build `ExecutionMeta`; `executeTool` signature/body untouched.

## 12. Gateway instrumentation-failure semantics — awaited, fail-open (Refinement 6)
- **No fire-and-forget.** `tool executes → result captured → `try { await recordGatewayActivity() } catch { console.warn('[gateway] telemetry failed', {executionId, contractId, capability, err}) }` → return the exact original result.` A telemetry failure **never** converts a successful tool into a failure (mirrors PR-1's fail-open).
- Contract-build/classification throwing → caught, warn, tool still runs.
- **No timeout subsystem** in PR-2. Current MCP/tool timing behavior preserved.

## 13. Expected DB-write / latency overhead
- Telemetry flag **off:** wrapper runs, `executeTool` called as today, **no** telemetry write → ~zero overhead.
- Telemetry flag **on:** **+1 awaited INSERT per tool invocation (all invocations, incl. reads).** A chat turn with N tool calls → N small inserts, each awaited *after* its tool (which itself took tens–hundreds ms), each ~1–5 ms and dwarfed by the multi-second model round-trip. Per your explicit trade-off, this is an excellent price for complete observability. If a specific high-volume path ever needs relief, the flag can disable the write while the **gateway path stays unconditional**.

## 14. Feature flag / rollout (Refinement: telemetry-only, no schema field)
- **Env flag only:** `GATEWAY_TELEMETRY_ENABLED` gates the ActivityEvent **write**. **The gateway call path (`core → gateway → executeTool`) is always on and cannot be flagged off.** **No `PlatformSettings` field, no schema change.**
- Rollout: land the gateway (path always on) with telemetry default-on in non-prod, verify GATEWAY rows for READ/WRITE/EXTERNAL with correct effect + no raw content, then enable in prod. No user-visible change.

## 15. Tests
- **Unit (`lib/agent/gateway.test.ts`):** pass-through returns byte-identical result to a stubbed `executeTool`; **awaited fail-open** (telemetry throws → tool result still returned); `effect` classification (read/write/mcp→external/unmapped→unknown); deterministic outcome parser (`{ok:false}`→error+generic class, `{ok:true}`→success, non-envelope→success); `structuralMeta` stores only keys/sizes, **never values/titles/messages**; contract carries actor=AGENT + initiator separate.
- **Integration (extend `lib/activity/activity-event.test.ts`, env-guarded):** a READ invocation and a WRITE invocation each write **exactly one** `source=GATEWAY` row with correct `effect`, `executionId`, `contractId` (== sourceId), `outcome`, `durationMs`, and **no raw content**; a duplicate telemetry write with the same `contractId` is idempotent (unique `(source,sourceId)`); a task run uses `TaskAttempt.id` as `executionId`; `runToolLoopStream`→`runToolLoop` fallback keeps the **same** executionId.
- **No-bypass guard:** assert `executeTool` has exactly one production caller (the gateway) — grep-style check + a core.ts routing test.
- **Public-surface leak test:** a customer-path tool call writes server-side GATEWAY telemetry but the SSE response to the customer is unchanged (no tool names/metadata/errors).

## 16. Exact files expected to change
- **NEW** `lib/agent/gateway.ts` (gateway + `structuralMeta` + `effectFor` + `parseOutcome`).
- `lib/agent/core.ts` — replace both `executeTool(...)` calls (`:141`, `:202`) with `runToolThroughGateway(...)`; extend `ToolLoopArgs` (`:76`) with `meta: ExecutionMeta`; ensure `runToolLoopStream`'s fallback (`:165`) forwards the **same** meta.
- Entry points build `ExecutionMeta` + generate/pass `executionId`: `lib/agent/run.ts` (~`:175`, initiator HUMAN+userId, surface internal), `lib/agent/public-chat.ts` (~`:196`, initiator CUSTOMER no userId, surface customer), `lib/agent/sandbox.ts` (~`:83`, initiator HUMAN), `lib/agent/task.ts` (`:127`; **and change the `TaskAttempt.create` at `:89` to `select:{id:true}`** and use `attempt.id` as executionId; initiator SYSTEM).
- **NEW** tests (§15).
- **NO change** to `lib/agent/tools.ts` `executeTool`/schemas, `getToolsForAgent`, prompts, permissions, or `prisma/schema.prisma` (PR-1 columns + unique suffice; env flag only).

## 17. Acceptance criteria
1. **Permanent chokepoint:** `core.ts` routes tool execution only through `runToolThroughGateway`; **`executeTool` has exactly one production caller (the gateway)** — verified by grep + test. The telemetry flag never bypasses the gateway.
2. Every tool invocation (incl. reads) writes exactly one `source=GATEWAY` ActivityEvent with `sourceId=contractId`, correct `effect`, `executionId`, `outcome`, `durationMs`.
3. **Actor vs initiator:** rows have `actorType=AGENT`, `actorId=agentId`; initiator stored in metadata only when reliable; customer runs carry no initiator userId.
4. `executionId` is generated once per run (or = `TaskAttempt.id`) and is **identical** across the `runToolLoopStream→runToolLoop` fallback; each invocation has its own `contractId`.
5. Telemetry write is **awaited + fail-open**: a telemetry failure never fails a successful tool.
6. **No raw content** stored: no args/results/titles/names/snippets/error messages; only structural metadata.
7. Idempotent telemetry: duplicate contract write → no duplicate row (`@@unique([source,sourceId])`).
8. Pass-through: tool names/arg schemas/results-to-LLM/permissions/prompts/customer-facing behavior unchanged; no data leaks to the storefront. `tsc` + full CI green. No schema change.

## 18. Rollback
- Telemetry flag off → gateway path still runs (chokepoint preserved), no rows written.
- Full revert → removing the gateway restores `core → executeTool` (and reverts the `task.ts` `select:{id:true}` line). Additive, no schema/data migration. GATEWAY rows are inert history.

## 19. Explicit non-goals
Enforcement (tenantAssert, capability policy, autonomy levels, budgets, approvals, idempotency, credential broker) — designed as insertion points, **inactive**; `AgentExecution` DB model; timeouts; DLP/content scanning; capability registry; read-surface consuming ActivityEvent; changes to tool names/args/results/prompts/permissions; workflow engine; **material-only filtering (we log all)**; TD-2 (Agent-Intelligence-Reliability).

## 20. Over-engineering flags → simpler alternative
| Tempting | PR-2 choice |
|---|---|
| `AgentExecution` DB model | Runtime `executionId` (reuse `TaskAttempt.id`); persist only on `ActivityEvent.executionId` |
| Start + completed events per tool | One terminal event per invocation |
| Capability registry for `effect` | Small static `effectFor` map + `UNKNOWN`/`EXTERNAL` defaults (PR-6 replaces) |
| Storing args/results + DLP | Structural metadata only (keys, sizes, effect, outcome); never values |
| Fire-and-forget telemetry | **Awaited, fail-open** write (reliable + non-blocking to the business op) |
| `PlatformSettings` flag field | Env flag for telemetry write only; gateway path unconditional |
| Feature-flag-off bypass of the gateway | Gateway is permanent; only the telemetry write is toggleable |

---

*Rev 2 — design only. No code, no migration. Enforcement stays for later PRs; TD-2 remains queued and untouched.*
