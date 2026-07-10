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
tracking).

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
and task **`depends_on`** chains (Phase 3 partial). Remaining: `request_from_agent`
(synchronous ask), composable Skills, the ops command center. See
[`AGENT_SYSTEM.md`](./AGENT_SYSTEM.md).

### 1b. Service-business capability gaps (from the sector-fit audit)
Table-stakes a generic appointment SMB expects, ranked. None are blockers to
launch, but they remove real friction:
- **Company-level business hours + holiday closures** that services inherit unless
  overridden (today hours are per-service only — a 20-service salon sets them 20×).
  **Top priority.**
- ~~**Reminders/confirmations**~~ **SHIPPED** — owner-controllable booking
  confirmation email + a reminder N hours before (Settings → Reminders, email
  channel; SMS/WhatsApp channels next). Runs off /api/cron/run.
- **Cancellation policy + deposits/prepayment** — optional per-service deposit % +
  a company cancellation window; gate slot-holding on deposit (payments infra exists).
- **Reviews/ratings** — post-completion review request + display on the public site.
- **Later:** multi-location (branch dimension) · recurring/package bookings
  (class-passes, session packs).

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
