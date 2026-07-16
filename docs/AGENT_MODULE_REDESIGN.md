# Agent Module Redesign — precision, governance & accuracy (2026-07-16)

> The full record of the AI-module overhaul that makes agent configuration
> **rival and beat OpenClaw**: one governed setting per concern, per-agent
> guardrails, owner-editable KPIs, honest capability display — plus the
> platform-wide **agent-accuracy fixes** surfaced by live multi-sector demo
> testing, and the demo tenants themselves.
> Architecture background: [`AGENT_SYSTEM.md`](./AGENT_SYSTEM.md) ·
> strategy: [`OPENCLAW_PARITY.md`](./OPENCLAW_PARITY.md).

---

## Why (the audit)

A full audit of the 9 workforce sections (agents, agent-work, skills, studio,
outputs, departments, knowledge, data + admin/models) found the agent config had
grown **three parallel axes that should each be ONE**, plus dead knobs and
governance gaps:

| # | Finding | Evidence |
|---|---------|----------|
| A1 | **Two model selectors** — capability tier (Fast/Balanced/Advanced) *and* a registry dropdown; "Fast" and "Balanced" both resolved to `gemini-2.5-flash`, and a registry pick from another provider was **silently dropped** at inference (`agentModelId`) | `agent-form.tsx`, `lib/agent/core.ts` |
| A2 | **Four "who is this agent" fields** — `persona` (free text), `personaConfig` (structured), `jobDescription`, `systemPrompt`. The required free-text `persona` was **dead**: never injected once a structured `personaConfig` exists — which the form always sent | `lib/agent/prompt.ts` |
| A4 | **Tool-granting via 4 overlapping mechanisms** (permission matrix ∪ skills ∪ `use_mcp` ∪ archetype seeds) with no unified view — the profile understated what the agent could actually do | `lib/agent/run.ts` |
| A5 | **Three trigger UIs with two different event vocabularies** (create-form scenarios: 5 events; profile Scenarios tab + Knowledge TriggerManager: only 3) | validators + components |
| — | Dead knobs: `maxTokens` hardcoded 4096, `signaturePhrases` hardcoded `[]`; default drift (SONNET vs HAIKU, 0.7 vs 0.6) | form submit path |
| — | Governance gaps: approvals/spend caps were **company-wide only**; no per-agent caps; no test-before-rely; "empty permissions = all tools" (no least-privilege default); KPIs seed-only and custom hires got **none** | settings/guardrails |

**Thesis: collapse every duplicated axis to one + add a per-agent governance
layer + test-before-rely.**

---

## Phase 1 — Agent configuration form (deployed `384e253`)

The create/edit form (`components/dashboard/agent-form.tsx`, shared by
`/agents/new` and the profile Settings tab).

### ONE model picker
- The registry dropdown is now the **only** model selector; the tier cards are
  gone. Picking a registry model also derives its tier for the fallback path
  (`pickModel()`); "Default (recommended)" clears to the tier map.
- Pages (`agents/new/page.tsx`, `agents/[id]/page.tsx`) **filter the registry
  to the company's ACTIVE provider** (`getProviderForCompany`), fixing the
  silent-drop bug: the picker can no longer offer a model that wouldn't run.
- When the registry is empty, a minimal Standard/Advanced pair remains as the
  fallback UI.

### ONE instructions model
- `jobDescription` ("Instructions & mandate") is now the **single** behavior
  field. The free-text `persona` textarea and the "extra instructions"
  (`systemPrompt`) textarea were **removed from the form**.
- The NOT-NULL `Agent.persona` column stays meaningful: the server derives a
  one-line summary via `derivePersonaSummary(role, jobDescription)`
  (`lib/agent/persona.ts`) on create (hr-agent) and update (action).
- The structured persona (tone / verbosity / language / dos / donts) remains
  the behavioral persona, compiled deterministically into the prompt.

### Governed response shape
- **Response style** presets (Precise 0.2 / Balanced 0.6 / Creative 0.9)
  replace the raw temperature slider (stored value is still
  `Agent.temperature`).
- **Verbosity now drives `maxTokens`** via `maxTokensForVerbosity()`
  (concise 2048 · balanced 4096 · detailed 8192) — no more hidden constant.

### Per-agent governance (NEW)
- Three nullable columns on `Agent` (migration
  `20260716000000_agent_governance`, additive):
  `requireApprovalForSensitive Boolean?` · `requireMessageReview Boolean?` ·
  `spendApprovalCapSar Int?` — **null = inherit the company guardrail**.
- The form's "Governance & limits" card exposes each as
  Inherit / Required / Off (+ a SAR number input for the cap).
- Runtime resolution: `resolveGuardrails(agent, company)` in
  `lib/agent/prompt.ts` — per-agent overrides win, fall back to company; a
  per-agent cap implies cap-enabled even if the company's is off. Wired on
  **all three** prompt paths: chat (`run.ts`), autonomous tasks (`task.ts`),
  and the Studio sandbox (`sandbox.ts`).

### Least-privilege + test-before-rely
- Selecting an archetype now **seeds its tool bundle** into the permission
  matrix (only when the current set is empty or still equals another
  archetype's bundle — a hand-picked set is never clobbered).
- The edit form gained a **"Test in Studio"** card deep-linking to
  `/studio?agent=<id>`; `StudioPage` + `StudioClient` accept the param and
  preselect the agent.

Plumbing: validator (`lib/validators/agents.ts`) gained the three governance
fields and made `persona` optional; `DeployPayload`/hr-agent and the
create/update actions pass everything through.

---

## Phase 2 — Agent profile (deployed `9c9d8f8`)

`app/(dashboard)/agents/[id]/page.tsx`.

### Owner-editable KPIs
- New `AgentKpisEditor` (client) on the KPIs tab: add/edit/remove up to 8 rows
  of `{key, label, target, unit}`, saved through the zod-validated
  `updateAgentKpis` server action (`lib/actions/agents.ts`).
- **Custom hires now start with KPIs**: the HR custom path seeds
  `kpis: archetype.kpis` (previously only template hires got any).
  Seeded values are explicitly a starting point.

### Effective capabilities rail
- The rail now shows what the runtime actually grants:
  **modules ∩ (permissions ∪ skill-granted tools)** — matching `run.ts` instead
  of understating. Skill-granted chips render **dashed** with a
  "{n} granted by skills" caption; an **MCP** badge appears when granted
  (`use_mcp` or legacy empty-permissions).

### Real model label
- Header chip + facts rail show the pinned registry model's **label**
  (`agent.aiModel.label`) or "Default (auto)" — replacing the stale
  Fast/Balanced tier chip that contradicted Studio/runtime.

### Unified trigger catalog (kills A5)
- `triggerSchema` (`lib/validators/knowledge.ts`) accepts **all five**
  `TriggerEvent`s; the profile Scenarios tab (`agent-scenarios.tsx`) and the
  Knowledge TriggerManager (`trigger-manager.tsx`) both render from the shared
  `TRIGGER_EVENTS` catalog with the `events.*` labels — one vocabulary in
  every trigger UI (adds CART_ABANDONED + COMPLAINT_RECEIVED where missing).

---

## Multi-sector demo tenants (deployed `f690809`)

Purpose: populate the platform like a **real running business** in three very
different Saudi sectors, so every section can be tested end-to-end.

| Slug | Business | Exercises |
|------|----------|-----------|
| `/basma` | عيادة بسمة الرياض — dental clinic (Riyadh) | services + bookings + staff + patients; 11 services, 6 departments, 4 agents |
| `/almaali` | دار المعالي للعقارات — real-estate office (Riyadh) | **Business Objects** (a `properties` type with 8 listings) + viewings-as-bookings + CRM; brokerage services |
| `/khedmatak` | خدمتك — home services (Dammam) | field services + teams + orders; open 7 days |

Each tenant seeds: company (+DNA, settings, wallet, hours, holiday), landing
storefront + chat widget, departments, services (+availability windows), staff
(with commission models), **4 agents in distinct roles** hired through the real
`hrAgent.onboardAndDeployAgent` gateway (`force:true` skips the conflict AI
call; demo KPIs/performance stats layered after), ~15 customers, ~10 bookings
(past **and** future, slot-aligned in Asia/Riyadh), service orders (VAT 15%),
FAQ, coupons, agent outputs, in-flight tasks, and reviews.

- Code: `lib/seed/demo-tenants.ts` (engine) + `lib/seed/demo-tenants.data.ts`
  (the three specs). `AgentSpec.extraTools` grants tools beyond the archetype
  bundle (the real-estate agents get `list_object_types` + `query_records`).
- Trigger: super-admin `/admin` → **Seed demo tenants** button
  (`SeedDemoButton` → `seedDemoTenants(only?)` action) — seeds one tenant per
  request; **idempotent** per tenant (ordered FK-safe wipe by `companyId`,
  upsert company-by-slug / owner-by-email).
- Owner logins: `owner@basma-dental.sa` / `owner@almaali-realestate.sa` /
  `owner@khedmatak.sa`, password `DEMO_PASSWORD` env (fallback `demo1234`).
- ⚠️ Agent **permissions are granted at hire** — changing seeded permissions
  requires a re-seed (the button), not just a deploy.

---

## Agent-accuracy fixes (deployed `58fd535`) — found by the demo

Live testing of the three storefront widgets exposed real platform defects
behind flaky/wrong replies. All fixed platform-wide:

1. **`search_catalog` matching** (`lib/agent/tools.ts`)
   - Was: literal `contains` on **title only** — "التقويم الشفاف" missed the
     service titled "تقويم شفاف"; the agent then wrongly said *not available*.
   - Now: word-by-word matching across **title + subtitle + description**, and
     each word expands to Arabic surface variants — definite-article prefixes
     stripped (`ال/وال/بال/فال/كال/لل`) and hamza-on-alef toggled (اسنان↔أسنان).
2. **No truncation**: `take: 10` silently dropped an arbitrary item for a
   business with 11+ services (the agent then denied an existing service).
   Now `take: 30` + stable `sortOrder`.
3. **Kind-agnostic fallback**: when the wording matches nothing, the tool
   returns the real catalog — now ignoring the model's `kind` filter (a wrong
   `kind:'product'` in a services-only business used to return empty).
4. **Business Objects for public agents** (`lib/agent/public-chat.ts`):
   `list_object_types` + `query_records` added to `PUBLIC_ALLOWLIST` — still
   gated by the agent's own permissions + the hasObjects module, so exposure
   stays per-agent intentional. This is what lets an object-centric business
   (real estate) answer from the widget.
5. **Prompt hardening** (`lib/agent/prompt.ts`, customer + internal branches):
   any price/service/availability question **must call `search_catalog` every
   time** (never quote a price from memory or the FAQ, never round); never
   declare a service unavailable when the (fallback) catalog is in the result;
   when the business has custom data types, call `list_object_types` →
   `query_records` and show real records **before** over-asking qualifying
   questions.
6. **Reliable tool-calling** (`lib/agent/public-chat.ts`): the public widget
   now runs with `thinkingBudget: 1024` (was 0-for-snappiness). With thinking
   off, gemini-flash intermittently answered reflexively from memory — the
   same question returned the right price once and "not available" the next.
   ~1s of first-token latency buys consistent tool use; verified 900-SAR ×7
   consecutive correct replies after the change.

**Verified live** (widget SSE, production): dental prices exact and stable;
"التقويم الشفاف"→5500; home-services word-match "تنظيف المكيفات"→150; real
estate lists its actual records (6 available listings with districts + prices,
auto-hiding the reserved/rented ones).

---

## Ops: deploy verification (`/api/version`)

**PUSHED ≠ LIVE.** Coolify's auto-deploy queue stalled for ~95 minutes while 5
pushes piled up — every "verify on prod" hit the OLD container and looked like
phantom flakiness. Countermeasures now in place:

- `GET /api/version` (`app/api/version/route.ts`) returns
  `{ marker, commit }`; bump the `MARKER` constant on deploys that need
  authoritative verification, or compare the `sentry-release` sha embedded in
  any page's HTML.
- Workflow: push → poll `/api/version` until the marker flips → only then run
  behavioral verification. If stale for >15 min, trigger a manual deploy in
  Coolify (and investigate the webhook).

---

## Earlier-same-arc chat fixes (context)

Shipped just before the redesign (see git history `4aa5cea…348a7b9`): dashboard
chat latency work (parallel pre-flight, thinking off **for the internal
dashboard path**, `[chat-timing]` logs), SSE anti-proxy-buffering (2KB primer +
15s keepalives on both chat routes), three-dot typing indicators (dashboard +
widget), and the widget "doesn't reply" fix (the public chat route now resolves
the designated agent exactly like the landing page — active + CUSTOMER_FACING
or fallback). Note the split that remains **by design**: internal dashboard
chat keeps `thinkingBudget: 0` (owner wants speed; strict tool rules cover it),
the public widget uses `1024` (customer-facing accuracy wins).

---

## Remaining phases

- **Phase 4 — Skills**: clarify skills-vs-permissions on `/skills`, expose the
  tool contribution per skill, surface icon/category.
- **Phase 5 — Light sections polish**: agent-work / outputs / departments /
  data — naming consistency, dead-control removal.
- Docs translation: `PROJECT.md` + the Arabic parts of `AGENT_SYSTEM.md` to
  English (tracked in TODO).
