# Changelog

All notable changes to NX iWork are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

> ⚠️ **This is a historical log — newest first.** Entries describe what shipped at
> the time; some early decisions were later **superseded** (BYOK-first → managed
> Vertex; Voyage → Gemini embeddings; `nx.sa`/subdomains → `bznss.one` path-based;
> Next.js 15 → 16). For the **current** state and direction, see
> [`docs/CONTINUE_HERE.md`](docs/CONTINUE_HERE.md) and [`docs/PROJECT.md`](docs/PROJECT.md).

---

## 2026-07-09 — Business modules: 360° counters, coupons, inventory, staff commissions

Broaden the platform to cover the whole business, not just the AI workforce.

### Added
- **360° Command Center counters** (`business-counters.tsx`) — a whole-business
  snapshot band on `/overview`: customers, upcoming bookings, month revenue, orders,
  workforce-online, and inventory, each with a status breakdown; a self-contained
  async server component (its own tenant-scoped aggregates).
- **Discount coupons** — `Coupon` model + `/coupons` CRUD + `checkCoupon()` validator
  (percent/fixed; scope products/services/bookings/all; min-subtotal; max-redemptions;
  active window). `Order` gains `couponId` + `discount`.
- **Consumables / raw-materials inventory** — `InventoryItem` model + `/inventory`
  (CRUD, quick stock +/- adjust, low-stock highlight) for businesses like clinics/salons.
- **Staff + commissions** — `StaffMember` model (`/staff` CRUD) with a commission rule
  (`PERCENT_SALES` / `FIXED_PER_ORDER` / `TARGET_BONUS`). `Order`/`Booking` gain
  `staffMemberId`; `/commissions` computes each staff's attributed revenue + earned
  commission + target progress for the month — deterministically, no ledger to drift.
- **Nav:** Workforce → +Staff +Commissions · Sales → +Coupons · Products & Services → +Inventory.
- **Demo seed** extended with 4 staff (attributed orders/bookings), 4 coupons, 5 inventory items.

### Migration
`20260709120000_coupons_inventory_staff` — additive: 3 tables + nullable Order/Booking columns.

---

## 2026-07-09 — Design-handoff redesign complete + business-first nav + Sales + demo/tests

Finishes the `design_handoff_ai_company` rebuild and makes the autonomous-workforce
mechanics **real** (not cosmetic), then reorganizes the platform around how a
business owner actually thinks.

### Added
- **Global top bar (View 1 chrome).** Token-bank pill (`Company.tokenBalance` + plan),
  a **real Automation toggle** (`AutomationToggle`), and a **"N need you" bell** (pending
  approvals → `/approvals`) — data wired through `app/(dashboard)/layout.tsx`.
- **Guardrails (View 4, `/settings` default tab).** New `Company` flags
  (`automationEnabled`, `requireApprovalForSensitive`, `requireMessageReview`,
  `spendApprovalCapEnabled`, `spendApprovalCapSar`; additive migration) +
  `updateGuardrails` action + `GuardrailsTab` (dark token/wallet card, design-exact
  42×24 toggles, spend-cap SAR, plan-derived per-agent cap).
- **Autonomy dial** — `AutonomyLevel` (`SUGGEST`/`ASK`/`AUTOPILOT`) surfaced in the
  agent workspace + creation form; drives `request_approval` aggressiveness.
- **Agent workspace (View 2).** NEEDS-YOU pill, real **Pause agent** (`setAgentPaused`),
  the **WORK LOG** (flat, English, relative-time), the **3-layer memory** view
  (Working/Episodic/Semantic with real per-agent counts), an internal-mode **chat entry**
  (`/chat?agent=<id>` — `ChatClient` gains `initialAgentId`).
- **Approvals (View 3)** — dedicated `/approvals` inbox + design-proportioned `ApprovalCard`.
- **New-department modal (Modal B)** — 440px overlay with 34px hue swatches.
- **Sales financial section (`/sales`)** — revenue KPIs, orders-by-status pipeline,
  invoices (`Invoice` model, PDF links), wallet/plan; all tenant-scoped real data.
- **Demo seed** — `scripts/seed-demo.ts` (`npm run seed:demo`): an idempotent,
  self-contained **"Zahra Home"** tenant across every surface (departments, agents,
  customers, catalog, orders, invoices, bookings, tasks, pending approvals, timeline,
  memories, schedules).
- **Tests (vitest)** — guardrails/autonomy prompt injection + dept-accent hues (9 passing).

### Changed
- **Business-first navigation.** Regrouped into Command Center · Workforce (agents +
  departments) · **Sales** (financials, orders, customers, clients, bookings) ·
  **Products & Services** · Billing · Configure. Adds `hasServices` gating; the mobile
  tab bar + section carousel inherit it.
- **Guardrails are enforced.** The Automation switch **gates the scheduler**
  (`runDueSchedules`/`runDueTasks` skip `automationEnabled=false` tenants and `PAUSED`
  agents); the guardrail flags are **injected into `buildSystemPrompt`**, overriding the
  autonomy dial.

---

## 2026-07-08 — Command Center redesign (from the design handoff)

Rebuild the owner dashboard to the `design_handoff_ai_company` spec (the new
source of truth, per the root `CLAUDE.md`) — a warm "Command Center" for an AI
workforce, replacing the Aurora theme inside the dashboard.

### Added
- **Design foundation.** A `.theme-command` warm-neutral palette scoped to the
  (dashboard) root (marketing keeps Aurora) + the per-department **oklch accent**
  system (`.dept-*` utilities + `lib/ui/dept-accent.ts`, one stable hue per dept).
- **Holographic agent avatars** (`holographic-avatar.tsx`) — deterministic SVG
  from the agent id (hue + facets + eyes + scanlines all seed-derived); every
  agent is visually distinct, no image assets.
- **Command Center (`/overview`)** — replaces the old KPI dashboard: the workforce
  **roster grouped by department** (reusable `AgentCard` with NEEDS-YOU / progress
  / trigger+model states) + a right rail of **approvals** (`ApprovalCard`) and a
  **live activity** feed (`TimelineEvent`).
- **Approval loop — owner side.** `resolveApproval` action (approve / send back):
  records the decision and **wakes the agent** with a follow-up task (the
  two-layer contract's human-in-the-loop). Found the `Approval` model was
  scaffolded-but-unwired; the agent-side `request_approval` tool is next.

### Next
Agent workspace · hire modal · guardrails · new-department modal · global top bar +
sidebar reorg · the `request_approval` agent tool.

---

## 2026-07-08 — Multi-agent Phase 1 + bookings adoption (in progress)

### Added
- **Multi-agent architecture — Phase 1 (Job Spec).**
  - `Agent.jobDescription` "constitution" (mandate + boundaries, distinct from
    `persona`) — injected into `buildSystemPrompt`, anchoring the two-layer
    contract at the agent level. Threaded through the HR gateway, actions, and
    the agent form.
  - **Per-department permission matrix** — the tool toggles are grouped by
    functional area (sales / catalog / bookings / support / operations / memory)
    over the existing `getToolsForAgent` hard gate (cross-department allowed).
  - **"Justification test"** callout in the agent-creation form (deterministic
    responsibility → workflow; judgment → agent).
- **Bookings adoption (from NXBook) — deterministic engine + calendar.**
  - `lib/booking/engine.ts` — the SYSTEM half of the two-layer contract:
    timezone-aware slot generation from weekly availability, capacity per slot,
    and a transaction-guarded `createBooking` (no overbooking). Agents complete
    bookings only via tools that route through this engine (bookings permission).
  - Schema: `ServiceAvailability` (weekly windows) + `Service.durationMin` /
    `bufferMin` / `maxCapacity` + `Booking.serviceId`. Additive migration.
  - `/bookings` becomes a **calendar** (month grid + per-day panel + inline
    confirm / mark-done / cancel + Calendar↔List toggle). `setBookingStatus`
    action (tenant-scoped).
  - Per-service **availability editor** (`/bookings/availability`) — the entry
    point that makes a catalog service bookable (duration/buffer/capacity +
    weekly windows).
  - **Public booking flow** — `GET /api/public/[slug]/slots` +
    `POST /api/public/[slug]/book` (thin wrappers over the engine) + a
    `booking-button` on the public page (date → live slots → details → confirm →
    localized confirmation email). Bookable services show Book; others keep the
    order button.
  - The agent `create_booking` tool is **routed through the engine** (optional
    `serviceId` → capacity enforced), so agents book via the system, never
    reimplement it. Customer-detail page gains **booking / spend KPIs**.

---

## 2026-07-08 — Env-aware 3 environments + Sentry + per-tenant email

### Added
- **Three environments** via `APP_ENV` (`lib/env.ts`): development / staging /
  production. `NODE_ENV` can't separate staging from prod, so `APP_ENV` drives
  payment test/live keys, noindex, the Sentry tag, and log verbosity. Boot-time
  guardrails warn on a test/live payment-key mismatch + missing critical integrations.
- **Sentry** (`@sentry/nextjs`): server/edge/client init, no-op unless a DSN is set,
  tagged by `APP_ENV`. `instrumentation` wires `register()` + `onRequestError`;
  `next.config` wrapped (source-map upload only with a build token).
- **`GET /api/health`** — public DB-round-trip probe (200/503, no secrets) for the
  Coolify health check + uptime monitors. Boot logs a one-line env summary.
- **Professional per-tenant email (Resend).** Central account sending from the
  platform's verified domain + per-tenant sender (`BusinessSettings.emailSenderName`,
  `emailReplyTo`, `marketingEmailsEnabled`; Settings → Email tab).
  `lib/notifications/tenant-email.ts` (`sendPlatformEmail` / `sendTenantEmail`;
  marketing gated + `List-Unsubscribe`). Wired: **welcome on signup** + **order
  confirmation** to the customer (tenant sender, localized). Public order form now
  captures an optional email (`Order.customerEmail` / `Customer.email`).

### Changed
- `.env.example` + `docs/*` realigned to the current direction (removed stale
  Moyasar / n8n / single-tenant / `nx.sa` framing; managed-Vertex-first).

---

## 2026-06-22 — Storage: quota + compression + docs structure

### Added
- **Multi-tenant storage quota.** `Plan.maxStorageBytes` (5/10/20 GB per tier) +
  `Company.storageUsedBytes` / `storageLimitBytes` (per-tenant override).
  `lib/storage/quota.ts`: atomic reserve (over-quota → HTTP 403 with an upgrade
  message) + release on delete. Admin `/admin/plans` (per-plan ceilings +
  ecosystem telemetry) and a per-tenant override on the company page.
- **`File` registry** (metadata, never bytes) written on every upload, with RLS.
- **Server-side image compression (sharp).** `app/api/uploads/image` → WebP q80,
  ≤1200px, graceful fallback to the original on failure. `lib/storage/image.ts`.
- **Documentation structure** brought to the international standard: `docs/README.md`
  (index), `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `docs/STORAGE.md`; fixed
  the stale BYOK decision (managed-Vertex-first) and stale `DEPLOYMENT.md` facts.

### Migrations
`20260622120000_tenant_files`, `20260622130000_storage_quota`.

---

## 2026-06-22 — Opportunities (CRM revamp) + Subscription

### Added — CRM (Zoho-style opportunities)
- **Customers → Opportunities.** The CRM page is now an opportunity/lead pipeline
  (won opportunities are your customers). Kanban **board** (drag cards between
  stages) + **list** view. New stage **DEFERRED** (مؤجلة) → stages: New ·
  Interested · Negotiating · Deferred · Won · Lost.
- **Opportunity 360° detail** — header (contact/source/agent/stage) + a unified
  **activity timeline**: notes, visits, reminders, meetings. Quick actions create
  a `CustomerNote` (note/visit) or a `Task` (reminder→REMINDER, meeting→APPOINTMENT
  — so they flow into the calendar/alerts). `lib/actions/crm-activity.ts`.
- **Convert to order** — turns a won opportunity into a linked `Order` and marks
  it WON. Any order created (public storefront, agent `create_order`, or convert)
  auto-advances the linked opportunity to WON. Orders link back to the opportunity.
- Data: `LeadStatus += DEFERRED`; new `CustomerNote` (NOTE/VISIT) model.
  Migrations `20260622110000`, `20260622110001`.

### Added — Subscription
- `/subscription`: current plan + upgrade options + invoices; pay from wallet or
  Tap (card/Apple Pay). Plan catalog seeded; `lib/billing/subscription.ts`.

---

## 2026-06-22 — Customer-facing arc (mobile + wallet + marketplace)

### Added
- **Mobile-first dashboard.** Swipeable section carousel under the topbar
  (`mobile-section-carousel.tsx`) + fixed bottom tab bar with a "More" sheet
  (`mobile-tabbar.tsx`); safe-area + RTL aware. Replaced the hamburger drawer.
  `NAV_SECTIONS` exported from `sidebar.tsx` as the single nav source.
- **Wallet.** `Wallet` (SAR balance) + `WalletTransaction` ledger, separate from
  the AI token bank. `/wallet` page (balance, top-up, buy token credits, history).
  Top-up via **Tap.company** (`lib/payments/tap.ts`; webhook + return both
  re-verify the charge server-side; idempotent settle). Buy token credits debits
  the wallet and credits `Company.tokenBalance` atomically at the admin-set
  `PlatformSettings.tokenPricePerMillion`. Env: `TAP_SECRET_KEY`.
- **Services marketplace (structure).** `MarketplaceService` + `ServicePurchase`.
  Admin CRUD at `/admin/services`; customer `/services` buys with the wallet
  (`lib/marketplace.ts`). Activation/plugins deferred.
- **Admin bootstrap from env.** `ADMIN_EMAIL`/`ADMIN_PASSWORD` (+ allowlist
  `SUPER_ADMIN_EMAILS`) create/reconcile the super-admin on boot
  (`lib/seed-admin.ts`, `instrumentation.ts`).
- Gemini 2.5 **thinking-budget cap** (`VERTEX_THINKING_BUDGET`) to cut chat latency.

### Migrations (additive)
`20260621130000_wallet`, `20260621140000_marketplace`.

---

## [Unreleased]

<!-- ============================================================= -->
<!-- 2026-06-21 — Design overhaul, landing, admin console, prod      -->
<!-- hardening, token fix, streaming, conversation modes.            -->
<!-- ============================================================= -->

### Fixed — Token bank drained after a few chats
- `Company.tokenBalance` default **100k → 5,000,000** (gemini-2.5-flash "thinking"
  tokens drained 100k in ~10 chats). Migration restores existing accounts < 5M.
- Deduction confirmed correct: charges the real `usageMetadata.totalTokenCount`
  (no compounding). `chargeTokens` now returns the remaining balance and every
  chat logs `[token-guard] <surface> | tenant | used | remaining`.

### Added — Streaming dashboard chat (SSE)
- `AiProvider.completeStream` (Vertex) + `runToolLoopStream` + an `onDelta`
  callback; the chat route streams text deltas as SSE; the client renders them
  live. Tool-using turns resolve, then the final answer streams.

### Added — Conversation modes (customer vs owner)
- `buildSystemPrompt` gains `audience`: **`internal`** (dashboard + autonomous
  tasks — the agent knows it's talking to the OWNER, acts as their employee,
  executes via tools, reports) vs **`customer`** (public widget). Fixes "the agent
  replies to me like I'm a customer" in the dashboard.

### Added — Super Admin console (core)
- `app/(admin)/admin` guarded by `SUPER_ADMIN` (`lib/admin.ts`): overview totals,
  companies list+search, company detail (token top-up, change plan → re-applies
  per-agent caps, suspend/activate), platform-settings editor. `signupEnabled`
  gates `/api/auth/signup`. Mutations audited. See **`docs/ADMIN.md`**.
  `scripts/make-admin.ts` promotes a user to super admin.

### Added — Production hardening
- **AI rate limiter** (`lib/ai/retry.ts`): exponential backoff + jitter on 429 /
  RESOURCE_EXHAUSTED / 5xx / timeouts; wraps `complete`, `completeStream`, embeddings.
- **Per-agent tool permissions** (`Agent.permissions`): explicit function-calling
  allow-list, enforced in `getToolsForAgent` (module ∩ permissions; empty = all),
  set from template defaults or custom toggles.
- **Vector index** AgentMemory ivfflat → **HNSW** (cosine).
- `DATABASE_URL` connection-pool / PgBouncer guidance; CDN cache headers.

### Added — Design overhaul + marketing landing (Aurora)
- **Aurora design system**: brand gradient (cyan→violet), glass chrome, soft/glow
  shadows, spring motion (HoverLift/PageTransition/AnimatedCounter), **responsive
  mobile drawer nav**, confetti + auto-animate. **Light theme by default.**
- **Professional landing page** at `/`: code-built dashboard + website-widget
  mockups, stats, 3-step how-it-works, per-department agents, pricing, FAQ, CTA;
  **SEO** (`generateMetadata` + JSON-LD SoftwareApplication/FAQPage, single h1);
  **auth-aware nav** (My account when signed in).
- Strategic decision: next infra home is **Google Cloud Run** (`docs/INFRA.md`).

<!-- ============================================================= -->
<!-- 2026-06-20 — Reference codes, English-primary redesign,        -->
<!-- and the HR Agent lifecycle system. See docs/CONTINUE_HERE.md.  -->
<!-- ============================================================= -->

### Added — Row-Level Security (defense-in-depth tenant isolation)

- RLS **enabled + forced** on 26 tenant tables (`20260620170000_rls_policies`)
  with a `tenant_isolation` policy that is **permissive when no tenant is pinned**
  (`current_setting('app.current_tenant_id', true) IS NULL → allow`). Existing
  queries set no GUC, so behaviour is unchanged and the app keeps working;
  isolation is **enforced only inside a tx that pins the tenant**.
- **`lib/db-tenant.ts` `withTenant(companyId, fn)`** runs a callback in a tx that
  pins `app.current_tenant_id` (transaction-local, pooling-safe). The HR service
  already pins on hire. **Adopt `withTenant` across queries to fully enforce.**
- `User` excluded so auth always works. Rollback: `ALTER TABLE <t> DISABLE ROW
  LEVEL SECURITY`.

### Added — Per-agent monthly token cap by plan

- `Agent.tokenLimit/periodTokensUsed/periodStartedAt`; the HR service sets the cap
  from the company plan on hire (`lib/plans.ts` `AGENT_TOKEN_CAP`).
- **`lib/billing/agent-tokens.ts`** `checkAgentBudget` + `chargeAgentTokens`
  (UTC monthly reset); enforced in all three run paths (chat, task, public chat).
  Usage bar on the profile KPIs tab.

### Added — Sentiment-based complaint escalation → Telegram

- **`lib/agent/sentiment.ts`** two-stage detection (free multilingual keyword gate
  → `gemini-2.5-flash` confirm) on inbound public-chat messages.
- On an angry complaint: fire `COMPLAINT_RECEIVED` (wakes the assigned agent) +
  Telegram alert to the owner with an anger score + summary (best-effort).
- New `TriggerEvent`s `CART_ABANDONED` + `COMPLAINT_RECEIVED`; shared
  `lib/agent/events-catalog.ts`. **`lib/notify/telegram.ts`** per-company sender.
- Settings **Alerts** tab: Telegram bot token + chat id + "send test".

### Added — HR Agent lifecycle system (the single hiring gateway)

All agent creation flows through **`hrAgent.onboardAndDeployAgent`**
(`lib/agent/hr-agent.ts`) — the mandatory 7-step pipeline. **Never call
`db.agent.create` directly.**

- **9 system templates** (`AgentTemplate`, seeded via migration): Sales, Support,
  Marketing, Operations, Finance, Appointments, Lead Qualifier (SDR), Social
  Media, Account Manager — each with personality, core instructions, if-then
  scenarios, KPIs, permissions.
- **Hybrid creation** `/agents/new`: browse templates **or** build custom, with an
  **HR Advisory** hint (closest template) and a **Visual If-Then scenario builder**.
- **Conflict check** (`lib/agent/conflict-check.ts`): `gemini-2.5-flash` blocks a
  >80%-overlap duplicate role (names the existing employee, recommends modifying
  it). Fail-open; charges managed tokens.
- **Cognitive onboarding** (`lib/agent/cognitive-onboarding.ts`): seeds new-agent
  `AgentMemory` from business context + FAQ (1536-dim `gemini-embedding-001`).
- **Lifecycle status** `ONBOARDING → ONLINE`; agents serve only after onboarding.
- **Org chart** (`components/dashboard/organization-chart.tsx`) by `parentId`, with
  a Grid ⇄ Org chart toggle on the Employees page.
- **`POST /api/hr/deploy`** — hiring API (UI or an autonomous CEO agent); 409 on a
  refused near-duplicate.
- **Profile tabs**: Activity · Scenarios · KPIs & performance · Memory · Settings.
- SDK note: Gemini runs via the official **`@google-cloud/vertexai`** provider
  (managed Vertex + ADC), not `@google/genai`. Embeddings: `gemini-embedding-001`.

### Added — Per-tenant human-readable reference codes

- `CUS-001`, `AGT-001`, `PRD-…`, `SRV-…`, `BKG-…` via an atomic `RefCounter`
  (`lib/refs.ts`); never collide across tenants. Backfilled existing rows. Shown
  as a mono badge in CRM/products/bookings/agents lists + detail headers.

### Changed — English-primary redesign (Arabic stays secondary)

- **Default locale flipped to `en`** (`i18n/request.ts`); Arabic via the switcher.
- **Sidebar** regrouped into Workspace / Team / Sales / Knowledge & automation /
  Configure, with a brand mark.
- **Onboarding** rebuilt: language → business data → plan → username (live
  availability + reserved-name check via `/api/onboarding/slug-check`, previews the
  landing URL). `Company.plan` records the choice (billing deferred).
- **Settings** gained **Storefront** (logo + hero), **Custom domain** (CNAME/A-record
  DNS guidance), and **Alerts** tabs. Theme color picker drives the landing page.
- **Setup checklist** on the overview (logo, color, headline, FAQ, agent, domain).
- **i18n migration** complete for: overview, full CRM (list/detail/editor), and all
  section-page headers/empty-states/CTAs (products, orders, bookings, departments,
  agents, modules, knowledge, tasks). Deep interactive components still pending —
  see `docs/TODO.md`.

### Added — Public order flow (visitor → CRM → agent handles)

Closes the autonomy loop: a visitor orders from the public page → it's recorded
and the responsible agent follows up automatically.

- **`POST /api/public/[slug]/order`**: visitor places an order (product/service)
  → finds/creates a CRM customer (by phone) → records the `Order` → fires
  `ORDER_CREATED` so a configured agent follows up. Rate-limited, unauthenticated.
- **Landing page**: "اطلب الآن / اطلب الخدمة" buttons on products & services open
  an order form (`OrderButton`).
- **Dashboard `/orders`**: incoming orders list with status pipeline + quick
  status change + link to the CRM customer. Nav + i18n added.

### Added — Agents as real operators + persistent per-agent chat

- **Saved chat history per agent**: the dashboard chat now loads each agent's
  stored `ChatMessage` history on open, so conversations persist across reloads
  (each agent keeps its own thread).
- **Expanded agent write tools** — agents now operate the platform, not just
  read it:
  - `update_lead` → full CRM edit (name/phone/email + status/notes).
  - `create_order` → records an Order + fires `ORDER_CREATED` (sales loop).
  - `update_booking` → reschedule/cancel.
  - `update_task_status` → mark tasks done/cancelled.
  - Gated by module (sales tools need e-commerce/services; booking tools need
    bookings); capabilities panel updated.

### Added — Per-agent scenarios + autonomous task execution

- **Tasks never get ignored**: the scheduler now runs ANY due PENDING
  agent-initiated task (`runDueTasks`) — a request the owner makes in chat (the
  agent logs it via `create_task`, triggerType AGENT_TOOL) or an event trigger
  (EVENT) executes autonomously, even while the agent is busy. Owner tasks from
  the /tasks form stay manual; future-dated tasks wait. (Was: only EVENT tasks.)
- **Per-agent scenarios** (`AgentScenarios` on the profile settings tab):
  configure how *this* agent reacts to business events ("when a new lead/order
  arrives → do X"). Backed by the existing EventTrigger.
- Prompt: agents must log any owner request via `create_task` and confirm it —
  never ignore it, even mid-task.

> ⚠️ Autonomous execution requires the cron Scheduled Task hitting
> `/api/cron/run` every minute (Coolify) — otherwise tasks queue but don't run.

### Added — CRM pages + interactive UX (animations + action sounds)

- **CRM**: `/customers` (pipeline-filtered list, quick status change, manual add)
  and `/customers/[id]` (editable details + order/booking/task history). Agents
  populate it automatically via `create_lead`; owners manage it here.
- **Agent capabilities panel** on the profile: shows the exact tools the agent
  can use (driven by the company's enabled modules).
- **Interactive feedback** (`lib/ui/feedback.ts`): synthesized action sounds
  (success / error / scheduled / needs-approval) + toasts, wired into task run
  and CRM actions. Muteable via localStorage.
- **Motion** (`components/ui/motion.tsx`, framer-motion): tasteful staggered
  entrance for lists/cards.
- Nav: Customers added; overview CRM stat links to `/customers`.

### Added — Public landing page + agent widget; dashboard polish

- **Public business page** (`app/(public)/[slug]`): renders the company's
  WebsiteConfig (hero/about/contact) + catalog (services/products, shown per
  enabled module) + an **embedded chat widget**. Live at `/{slug}`.
- **Public chat** (`/api/public/[slug]/chat` + `lib/agent/public-chat.ts`):
  visitors talk to the company's designated widget agent — unauthenticated,
  rate-limited, logged to `PublicConversation`/`PublicMessage`, token-bank aware.
- **Agent profile = live timeline**: `/agents/[id]` activity tab is now an
  auto-refreshing vertical timeline (in-progress / done / scheduled) with a
  status dot, label, and timestamps per task + countdowns for scheduled runs;
  header shows status + completed/failed/token stats.
- **Overview dashboard rebuilt**: real stats (agents, departments, tasks,
  CRM, schedules, bookings), token-balance card (managed), recent-activity feed.
- **No more API-key messaging** in managed mode: the BYOK warning is gone from
  the overview, and chat no longer asks for a key (platform supplies AI).
- `docs/TODO.md` added (Super Admin SaaS console, Tap payments, …). README
  fully rewritten for the managed Vertex/ADC architecture (was BYOK).

### Added — ADC via env JSON (VPS-friendly) + in-container AI health check

- **`GOOGLE_APPLICATION_CREDENTIALS_JSON`**: paste the whole ADC/service-account
  JSON (e.g. from `gcloud auth application-default login --no-browser` on the
  VPS) as one env var. `ensureAdcFromEnv()` writes it to a temp file (perms 600)
  and points `GOOGLE_APPLICATION_CREDENTIALS` at it — no file mounts. Works for
  authorized_user and service_account credential types. Resolution order:
  inline creds → JSON env → file path → ambient ADC.
  - Verified locally: the temp file materializes and the SDK authenticates to
    Google (the request reaches Vertex; only an invalid project 403s).
- **`GET /api/ai/health`** (protected by `CRON_SECRET`): in-container Vertex
  smoke test (auth + chat + embeddings) — the standalone image can't run
  `tsx scripts/test-vertex.ts`, so curl this on the server instead.

### Changed — Keyless Vertex auth (ADC-first)

- Vertex/embeddings now resolve auth via **Application Default Credentials**
  when no inline key is set — `gcloud auth application-default login` locally, or
  the attached service account / Workload Identity on a host. `isVertexConfigured`/
  `isEmbeddingsConfigured` gate on `GCP_PROJECT_ID` only (no key required), so
  pure-ADC setups work. Inline env creds + mounted JSON remain optional overrides.
- `.env` for managed mode is now just `AI_MODE` + `GCP_PROJECT_ID` + `GCP_LOCATION`
  — no secrets. Docs (`AI_VERTEX.md` §4) + `.env.example` updated to ADC-first.

### Added — Modular architecture (per-business modules + dynamic tools)

Migration `20260619230000_modular_bookings` (additive).

- **Module flags on `Company`**: `hasEcommerce` (default on), `hasServices`
  (default on), `hasBookings` (default off). Managed at `/modules` — the owner
  enables only what their business needs.
- **Dynamic sidebar**: Products shows only with E-commerce, Bookings only with
  Bookings — each business gets a clean dashboard.
- **Dynamic AI tools** (`getToolsForCompany`): agents receive only the tools for
  enabled modules (catalog tools require e-commerce/services; booking tools
  require bookings). Cheaper context + the agent never offers what the business
  can't do. Wired through the shared agent loop.
- **Bookings module**: new `Booking` model + `check_availability` /
  `create_booking` tools (gated by `hasBookings`) + a `/bookings` page.
- Deliberately deferred the "unified knowledge bridge" (write-amplification /
  sync cost) — per-module search tools cover it (YAGNI).

### Added — FAQ knowledge base + event triggers (proactive automation)

Migration `20260619210000_faq_event_triggers` (additive).

- **FAQ knowledge base** (`FaqItem`): structured Q&A the agents read via the new
  **`search_faq`** tool — exact answers on policies/hours/shipping without PDF
  token bloat. Managed at `/knowledge`.
- **Event triggers** (`EventTrigger` + `lib/agent/events.ts`): "when EVENT
  happens, wake AGENT with this task". `dispatchEvent()` creates a PENDING task
  for the target agent; `runPendingEventTasks()` (in the scheduler, called by
  `/api/cron/run` + the worker) executes them. Wired: `create_lead` →
  `LEAD_CREATED`. Managed at `/knowledge`.
- New nav item **المعرفة** (`/knowledge`) with FAQ + trigger managers.
- Clarification: time-based scheduling (cron) was already built; this adds the
  *event-based* triggers that were deferred.

### Changed — Customer UX for managed mode (no keys; task visibility)

- **Settings: API-key tab hidden in managed mode** — the platform supplies AI
  centrally, so the customer never sees BYOK key settings (shown only when
  `AI_MODE=byok`).
- **Tasks page is now tabbed**: قيد التنفيذ / منجزة / مجدولة, with created/finished
  timestamps and a **live countdown** to each scheduled run.
- **Agent profile** (`/agents/[id]`): a real profile — header with status +
  stats (completed / failed / tokens) and tabs: **النشاط والمهام** (the agent's
  in-progress / done / scheduled work with countdowns) and **الإعدادات** (edit +
  automation). Reusable `<Countdown>` component.
- **Chat commands become tasks**: the agent prompt now instructs agents to log
  any order via `create_task`, so it surfaces in the agent's profile and the
  global task list automatically.

### Changed — Vertex credentials via env (swap accounts without file mounts)

- **Inline env credentials** (`lib/ai/gcp-auth.ts`): `GCP_CLIENT_EMAIL` +
  `GCP_PRIVATE_KEY` (copied from the service-account JSON) are now the preferred
  auth — passed to the Vertex SDK (`googleAuthOptions.credentials`) and to
  google-auth-library for embeddings. `GOOGLE_APPLICATION_CREDENTIALS` (mounted
  JSON) remains an automatic fallback. Swapping Google accounts is now a
  paste-and-restart in Coolify — no file mounts, no redeploy of paths.
- Private key stored one-line with escaped `\n`; restored to real newlines at
  runtime. **Verified live** with env-only credentials (file unset): chat +
  embeddings green.
- Docs (`AI_VERTEX.md` §4/§5) + `.env.example` updated to lead with env creds.

### Verified — Vertex AI live (service account) + model fix

- **Live smoke test passes** on `bznss-one` / `us-central1`: service-account
  auth, chat (`gemini-2.5-flash`), and embeddings (1536 dims) all work. Added
  `scripts/test-vertex.ts` (`npm run test:vertex`) as a reusable connectivity
  check (exits non-zero on failure).
- **Model ids corrected** to what the project actually exposes: `gemini-2.5-flash`
  (fast/balanced) + `gemini-2.5-pro` (advanced). The 2.0/1.5 ids returned 404.
- **Accurate token billing:** Gemini 2.5 "thinking" tokens are excluded from
  `candidatesTokenCount`, so the Vertex adapter now charges on
  `totalTokenCount − promptTokenCount` (token bank no longer under-counts).
- **New reference doc:** [`docs/AI_VERTEX.md`](docs/AI_VERTEX.md) — full setup,
  credentials handling (Coolify mount, never committed), models, token bank,
  verification, troubleshooting.

### Changed — Vertex AI is now the default AI path (strict, service-account)

- **`AI_MODE` defaults to `managed`** (was `byok`): the platform authenticates to
  Vertex AI with one service account for all tenants. BYOK is now opt-in only
  (`AI_MODE=byok`). The AI Studio API-key method is no longer used by default.
- **Embeddings moved to Vertex** (`lib/ai/embeddings.ts`): `gemini-embedding-001`
  via the Vertex predict endpoint, authenticated with the same service account
  (google-auth-library / ADC) — dropped the standalone `GOOGLE_AI_API_KEY`.
- ⚠️ **Deploy prerequisite:** managed mode needs `GCP_PROJECT_ID` +
  `GOOGLE_APPLICATION_CREDENTIALS` (mounted service-account JSON). Until set,
  agent chat/tasks return `vertex_not_configured` and embeddings are disabled.

### Added — Managed mode: Vertex AI + token bank

Optional alternative to BYOK, toggled by `AI_MODE=managed` (default stays `byok`).

- **Vertex AI provider** (`lib/ai/providers/vertex.ts`): official
  `@google-cloud/vertexai` SDK with service-account auth (`GCP_PROJECT_ID` +
  `GOOGLE_APPLICATION_CREDENTIALS`). Implements the same neutral `AiProvider`
  interface, so the agent loop / tools / token extraction are unchanged. Added
  `vertex` to the provider id + model map.
- **Managed factory**: in managed mode `getProviderForCompany` returns the
  platform Vertex provider for every tenant (no per-company key).
- **Token bank** (`lib/billing/tokens.ts`): `Company.tokenBalance` (migration
  `20260619190000_managed_token_bank`, default 100k trial grant). `checkTokenBudget`
  blocks a request at `<= 0` (HTTP 402 "billing limit reached"); `chargeTokens`
  atomically decrements by `usageMetadata` (prompt + candidate) tokens after each
  chat/task turn. Both are no-ops in BYOK mode, so callers are unconditional.
- Env: `AI_MODE`, `GCP_PROJECT_ID`, `GCP_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS`,
  `VERTEX_MODEL_*`.

### Added — Notifications layer (Resend email + Twilio SMS)

- **Provider-agnostic notifications** (`lib/notifications/`): neutral
  `EmailProvider`/`SmsProvider` interfaces + Resend (email) and Twilio (SMS)
  REST adapters. Same pattern as the AI/storage layers — swapping a channel is
  one new file, business code is untouched.
- `notifyEmail()`/`notifySms()` degrade gracefully (return a clear
  `*_not_configured` result) when a channel's env isn't set, so dev/staging
  flows never crash on a missing key.
- Env: `TWILIO_*` added; `RESEND_*` documented as the email channel.
- Wiring points (next): signup verification email, agent `send_sms` tool
  (gated behind rate limiting), billing receipts.

### Added — Storage layer (Cloudflare R2, portable)

- **Provider-agnostic storage** (`lib/storage/`): neutral `StorageProvider`
  interface + Cloudflare R2 adapter (S3 v3 SDK). Same code runs on AWS S3 /
  Alibaba OSS by changing endpoint + keys — keeps the platform portable.
- **Direct-to-bucket presigned uploads**: `POST /api/uploads/sign` returns a
  presigned PUT URL so files upload straight to R2 — bytes never transit the
  VPS (scales independently of app resources).
- **Per-tenant isolation**: `companyKey()` prefixes every object with
  `companies/{companyId}/…` and sanitises paths.
- Env: `R2_*` in `.env.example` (replaces the old unused `S3_*` placeholders).

### Added — Agent memory (semantic long-term recall)

- **Embeddings layer** (`lib/ai/embeddings.ts`): Google Gemini
  `gemini-embedding-001` at `outputDimensionality` 1536 — matches the existing
  `AgentMemory.embedding` vector(1536) (no migration) and stays on the platform's
  Google free tier (`GOOGLE_AI_API_KEY`). Platform-level so memory works even for
  companies whose chat provider is Claude. Unset key → semantic memory disabled,
  recall falls back to importance-ranked.
- **Memory module** (`lib/agent/memory.ts`): `saveMemory` (embed + store via raw
  pgvector SQL) and `recallMemories` (cosine-nearest via `<=>`, graceful
  fallback). `recallMemoryBlock` injects relevant facts into the system prompt.
- **`save_memory` tool**: the agent itself decides what's worth remembering
  (customer preferences, decisions, recurring facts). Recall runs each chat/task
  turn, so agents stop starting from zero.

### Added — Core agent system (workforce, tasks, automation)

- **Departments + Agents management**: full CRUD with a persona builder (role,
  department assignment, persona/system-prompt, model tier, creativity, manager
  hierarchy). Agents grid grouped by department. Archive = soft-delete.
- **Task execution engine** (`lib/agent/task.ts`): agents perform real tasks
  via the shared agent-loop core (`lib/agent/core.ts`, reused by chat) — drives
  PENDING→WORKING→DONE/FAILED with TaskAttempt rows, TimelineEvents, and agent
  stats. `/tasks` UI assigns, runs, and tracks; `POST /api/tasks/[id]/run`.
- **Scheduler / triggers** (`lib/agent/scheduler.ts` + `scripts/scheduler.ts`):
  a single-instance worker polls due `AgentSchedule`s each minute, turns each
  into a task, runs it, and advances the next cron tick. Per-agent automation UI
  with friendly presets (hourly/daily/weekly). This makes agents move on their
  own — no human in the loop.
  - Deploy as a SECOND Coolify service on the same image with command
    `npm run scheduler` (one instance — avoids duplicate fires across web
    replicas). Needs the same `DATABASE_URL` + AI/encryption env.

### Added — Priority 1: Agent Loop + Chat (multi-provider AI)

- **Provider-agnostic AI layer** (`lib/ai/`): neutral `AiProvider` interface with
  Anthropic (Claude) and Google (Gemini) adapters, plus a per-company factory
  (`getProviderForCompany`) that decrypts the BYOK key and picks the engine. The
  rest of the app never imports a vendor SDK.
- **Agent Loop v1** (`lib/agent/run.ts`): loads agent persona + CompanyDNA,
  pulls working-memory history, calls the company's provider, persists the turn
  and updates token stats. Tool use and deeper memory layers plug in here later.
- **Chat**: real chat UI (`/chat`) replacing the stub, chat API
  (`/api/agents/[agentId]/chat`), and a one-click "first AI employee" bootstrap.
- **BYOK is now multi-provider**: Settings lets each company choose Gemini or
  Claude (Gemini default for cost). Key-testing dispatches per provider
  (`testKey`), and `byokProvider` is persisted.

### Added — Priority 2: Function Calling + flexible data model

- **Flexible-for-any-business schema** (migration `20260619130000_crm_flexible_tasks`):
  - New **`Customer`** model (CRM lead pipeline: `LeadStatus` NEW→INTERESTED→
    NEGOTIATING→WON/LOST, assignable to an agent). Closes the gap where leads
    had no home.
  - **`customFields` (JSON)** on `Service`, `Product`, `Customer`, `Task` — any
    vertical adds its own attributes (bedrooms, check-in time, budget) without a
    schema change.
  - **Unified `Task`** via `TaskKind` (AGENT_TASK / APPOINTMENT / REMINDER) plus
    `startAt`/`endAt` for calendar use and an optional `customerId`. `agentId` is
    now nullable (appointments/reminders need no agent).
- **Tool use across both providers**: `AiTool`/`AiToolCall` in the neutral
  interface; Anthropic (`tool_use`/`tool_result`) and Gemini
  (`functionDeclarations`/`functionCall`) adapters.
- **Agent tools** (`lib/agent/tools.ts`, all company-scoped): `search_catalog`
  (structured data instead of PDF — big token saving), `find_customer`,
  `create_lead`, `update_lead`, `create_task`. The agent loop now runs a bounded
  tool-execution loop (`MAX_TOOL_ROUNDS`).

> Note: tool-calling wire formats are typechecked but need a live smoke test
> with a real Gemini/Claude key before launch.

---

## [0.1.1] - 2026-04-27

Patch release: deployment hardening and Alpine compatibility. No app
behavior changes — purely infrastructure to make `v0.1.0` actually run
in the Coolify/Docker target.

### Fixed
- **Docker runner stage failed on missing dirs.** `Dockerfile` copied `/app/public` and `/app/scripts` from the builder, but neither existed in the Sprint 0 source. Added an empty `public/` (with `.gitkeep`) and removed the `scripts` COPY (left a comment to restore it once Sprint 1+ adds `create-admin`/seed/scheduler scripts).
- **Prisma 7 ↔ schema 5 mismatch at runtime.** The original `CMD npx prisma migrate deploy && node server.js` fetched the latest Prisma CLI (7.8.0) from npm at container start, which rejected our 5.22 schema with *"datasource property `url` is no longer supported"*. Switched the CMD to JSON-array form invoking the pinned local CLI (also resolves the `JSONArgsRecommended` BuildKit warning).
- **Prisma CLI not available in standalone runner.** Next.js standalone tracing only follows static `require`/`import`, so the `prisma` CLI (invoked but never imported) was excluded. Explicitly `COPY` the `prisma` package from the builder. Tried promoting `prisma` to runtime deps first — confirmed standalone tracing still skips it, reverted to `devDependencies` and pinned to exact `5.22.0`.
- **`.bin/prisma` symlink resolved into a regular file.** Docker `COPY` of a symlink follows it on the source side, so `node_modules/.bin/prisma` arrived in the runner as a copy of `build/index.js`. At runtime that broke `__dirname`-relative loading of `prisma_schema_build_bg.wasm` (it was searched in `.bin/` instead of `prisma/build/`). Replaced the COPY with `mkdir -p .bin && ln -sf ../prisma/build/index.js .bin/prisma && chown -h nextjs:nodejs .bin/prisma` so the symlink is real and points at the actual file.
- **Prisma engine missing for Alpine + OpenSSL 3.x.** First DB query at signup failed with *"Prisma Client could not locate the Query Engine for runtime `linux-musl-openssl-3.0.x`"*. Added `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` to the generator block — schema metadata only, no migration required.

### Ops
- **`AUTH_TRUST_HOST=true`** must be set in Coolify environment (NextAuth v5 refuses to trust the proxy host otherwise, breaking sign-in behind Caddy). Add it alongside the other secrets documented in the v0.1.0 deploy guide.

### Planned for v1.0.0
- Sprint 0: Next.js setup, Auth, base layout
- Sprint 1: Onboarding, Settings, BYOK
- Sprint 2: Virtual HQ - Agents UI
- Sprint 3: Agent Loop & Memory System ⭐
- Sprint 4: Tasks, Approvals, Departments
- Sprint 5: Branding & Localization
- Sprint 6: Public Page & Chat Widget
- Sprint 7: Deployment & Custom Domains
- Sprint 8: Single-Tenant Mode & Polish

---

## [0.1.0] - 2026-04-27

### Sprint 0 — Foundations
- **Next.js 15 + Tailwind + TypeScript** baseline with `output: 'standalone'`
- **Fonts:** Tajawal (Arabic, default) + Inter (Latin) wired through Tailwind variables
- **Theme:** Dark default with Light toggle via `next-themes`
- **shadcn/ui primitives:** Button, Input, Card, Label, DropdownMenu, Sonner toaster
- **i18n (next-intl):** ar/en messages, RTL/LTR auto-detection from `<html dir>`, cookie-backed `setLocale` server action, `LanguageSwitcher` component
- **Prisma + PostgreSQL:** initial migration `20260427120000_init` (vector, pg_trgm, pgcrypto extensions), full schema for Companies, Agents, Tasks, BYOK API settings, 3-layer memory
- **NextAuth v5 (JWT):** Credentials provider with bcryptjs, edge-safe `lib/auth.config.ts` for middleware, typed Session/JWT augmentations in `types/next-auth.d.ts`
- **AES-256-GCM encryption helper** at `lib/encryption.ts` for BYOK keys
- **Auth pages:** `/login` and `/signup` with react-hook-form + zod validation, signup API at `/api/auth/signup` with bcrypt(12) hashing, automatic sign-in after signup
- **Dashboard shell:** sidebar nav (Overview/Agents/Departments/Tasks/Chat/Settings), topbar with theme toggle + language switcher + user menu, protected by middleware + server-side `auth()` check at `/overview`
- **Middleware:** route protection for dashboard prefixes, redirect-after-login via `?callbackUrl`

### Architecture Fix
- **next-intl + Next.js 16 compat:** `next-intl@3` writes its Turbopack alias under `experimental.turbo`, which Next 16 rejects. `next.config.ts` now promotes those keys to top-level `turbopack` after the plugin runs.

### Documentation
- Complete project planning with Walid (owner)
- PROJECT.md (constitution - dual-mode SaaS + single-tenant)
- DATABASE.md (full schema for BYOK + 3-layer memory)
- AGENT_SYSTEM.md (technical brain of the platform)
- ROADMAP.md (8 sprints, 47-58 hours estimate)
- DEPLOYMENT.md (Coolify guide with custom domains)
- START_HERE.md (Claude Code instructions)

### Architecture Decisions
- **Dual-mode platform:** Same code serves SaaS (multi-tenant) + Single-tenant (sold licenses)
- **BYOK only:** Customers bring their own Anthropic API key (eliminates billing complexity)
- **3-layer memory:** Working + Episodic + Semantic (pgvector)
- **Agent Loop:** Trigger-based wake-up with tool use + approvals
- **Configurable everything:** Language, currency, date, theme - all in Settings
- **Custom domains:** Caddy + Let's Encrypt for tenant domains
- **Pricing strategy:**
  - Phase 1 (Month 1-2): Sell licenses for 25K-100K SAR each
  - Phase 2 (Month 3+): Launch SaaS with 99/299/799 SAR plans

### Starter Files
- package.json (all dependencies)
- prisma/schema.prisma (complete database schema)
- .env.example (all environment variables)
- Dockerfile (multi-stage production build)
- .gitignore (comprehensive)

---

## Template for future releases

```
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes
```
