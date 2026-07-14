# 🗺️ Roadmap — NX iWork

> **Forward-looking, current plan.** For the flat backlog see [`TODO.md`](./TODO.md);
> for what already shipped see [`../CHANGELOG.md`](../CHANGELOG.md); for the resume
> snapshot see [`CONTINUE_HERE.md`](./CONTINUE_HERE.md).
>
> The original 8-sprint MVP plan has been fully delivered and is retired — it lived in
> Git history. This roadmap covers where the platform goes next.

## North star

An operations-management platform for **any** business, staffed by autonomous AI-agent
"employees" organized by department, with trigger control and inter-agent collaboration,
working without owner intervention. The **two-layer contract** is the design law: the
deterministic system owns transactions; agents do the human/judgment/communication work.
Positioned to compete with / replace OpenClaw — but more organized (calendars + task
tracking). The full OpenClaw-parity strategy, capability map, and gap analysis live in
[`OPENCLAW_PARITY.md`](./OPENCLAW_PARITY.md).

## ✅ Foundation shipped (live on bznss.one)

Managed Vertex AI + token bank · agents/departments/personas + HR gateway lifecycle ·
task engine + scheduler + event triggers · semantic memory (pgvector) · Opportunities
CRM + Customers directory · catalog + public storefront + agent widget + order flow ·
R2 storage (hybrid principle) + quota + image compression + "buy extra storage" add-on ·
Wallet + Tap top-ups + Subscription page + Services marketplace · per-tenant email
(Resend) · three-environment config (`APP_ENV`) + Sentry + `/api/health` · Aurora design +
mobile-first dashboard · **Command Center redesign** (design handoff) with **Guardrails &
Autonomy** (enforced), the **Sales** financials section, and **business-first navigation** ·
`npm run seed:demo`. See [`CHANGELOG.md`](../CHANGELOG.md).

## 🎯 Now → next

### 1. Multi-agent architecture (the headline)
Make every department's AI employee genuinely worthwhile alongside the deterministic
workflow, and let specialized agents compound.
- **Phase 1 — Job Spec foundation:** a **Job Description "constitution"** that governs
  each agent (distinct from `persona` = personality) · a **granular per-department
  permission matrix** built over the existing `getToolsForAgent` hard gate (incl.
  cross-department) · a **"justification test"** in the creation UX that nudges
  *deterministic responsibility → workflow* vs *judgment responsibility → agent*, so
  every agent is value-justified by design.
- **Phase 2 — Skills:** a composable skills system (OpenClaw-class, more organized).
- **Phase 3 — Orchestration:** an internal event bus + `delegate_to_agent` /
  `request_from_agent` / `depends_on`, fully autonomous via the scheduler.
- **Phase 4 — Ops command center:** a bookings calendar + an agent scheduled-task
  calendar + a task-tracking page.

**Shipped (2026-07):** the 3-layer sector-agnostic role model (archetype →
structured persona → mandate) + hard customer/internal `surface` scoping · the
unified **outputs hub** (`/outputs`) + `create_output` · **`delegate_to_agent`**
and task **`depends_on`** chains (Phase 3 partial) · **Phase 4 Ops command center
DONE** — **`/agent-work`** (task-monitoring queue + scheduled-runs calendar) ·
the **provider-agnostic model registry** (`/admin/models` + per-agent model +
**OpenAI adapter**) · **Business Objects** (owner-defined data types + agent
read/write tools). Remaining: `request_from_agent` (synchronous ask), composable
Skills. See [`AGENT_SYSTEM.md`](./AGENT_SYSTEM.md) + [`OPENCLAW_PARITY.md`](./OPENCLAW_PARITY.md).

### 1a. OpenClaw-parity reach + extensibility (the remaining gap)
The governance/organization half is done and ahead of OpenClaw; the gap is reach +
extensibility (full analysis in [`OPENCLAW_PARITY.md`](./OPENCLAW_PARITY.md)):
- **Channels — WhatsApp / Telegram inbound + a Router agent.** Per-tenant channel
  token + a webhook that maps an inbound message → the public-chat agent → a reply
  over the channel. Start with Telegram (most self-contained). **← highest-value next.**
- **MCP client + per-tenant server registry.** Register an MCP server (URL + auth)
  and expose its tools to chosen agents through the same `getToolsForAgent` gate.
- **Skills as first-class** — named, versioned capability bundles (prompt + allowed
  tools + example) an owner attaches to an agent.
- **Agent Studio / test sandbox** — a build/test surface showing tool calls + which
  model answered (today `/chat` is the owner↔agent console).

### 1b. Service-business capability gaps (from the sector-fit audit)
Most shipped in the 2026-07 hardening pass:
- ~~Company-level business hours + holiday closures~~ **SHIPPED** — services with
  no windows inherit them; holidays close the day (Settings → Hours).
- ~~Reminders/confirmations~~ **SHIPPED** — owner-controllable confirmation +
  N-hours-before reminder emails (Settings → Reminders), off /api/cron/run.
- ~~Reviews/ratings~~ **SHIPPED** — public submit + moderation (`/reviews`) +
  storefront display with average.
- ~~Cancellation policy~~ **SHIPPED** — owner text shown at booking + in the
  confirmation email (Settings → Hours).
- **Deposits/prepayment — DEFERRED:** needs the Tap payment flow exercised live
  (real money); build once deploy is up so it can be verified end-to-end.
- **Storefront modal-locale unification — DEFERRED:** chrome now follows the
  business language; the booking/order/review modals still use next-intl (visitor
  locale). A `NextIntlClientProvider` override for the `(public)` subtree is the
  clean fix — SSR-hydration-sensitive, best done live.
- **Later (LOW):** multi-location (branch dimension) · recurring/package bookings.

### 2. Billing completeness
- **Tap subscription auto-renewal** — recurring charges, webhook idempotency,
  dunning/retry on failure, receipt emails.

### 3. Email pro tier
- Verified **custom sending domain** per tenant (Resend Domains API) · billing receipts ·
  per-recipient marketing suppression.

### 4. Platform hardening
- **RLS hardening** — adopt `withTenant()` across tenant queries, then drop the
  permissive `IS NULL` fallback.
- **Storage follow-ups** — private/confidential files · presigned-POST size cap ·
  orphan-cleanup/reconcile job.
- **PDPL** — data export + hard-delete on account closure.

## 🌩️ Infrastructure direction

**Cloud Run** is the planned future infra home (see [`INFRA.md`](./INFRA.md)): Cloud
Scheduler → `/api/cron/run`, Redis for rate-limit/queue, Cloud SQL + PgBouncer, Secret
Manager + least-privilege Vertex service account. Cloudflare CDN is already in front.

## 📋 Later

Admin Phase 2 (impersonate-for-support, audit-log viewer, revenue charts, 2FA) · Public
API v1 · `CART_ABANDONED` dispatch source · deep-component i18n long-tail. Tracked in
[`TODO.md`](./TODO.md).
