# TODO — NX iWork

Tracked follow-ups beyond the current build. Newest first.
**Resuming? Start with `docs/CONTINUE_HERE.md`.**

## 🔜 Planned

### 🎯 Multi-agent architecture (the headline) — phased
The next major build. Make every department's AI employee worthwhile alongside the
deterministic workflow — the **two-layer contract**: the system owns transactions
(invoices/bookings/orders/CRM records) programmatically; agents do the human work
(judgment, communication, coordination) and *trigger* workflows.
- **Phase 1 — Job Spec — ✅ DONE.** Job Description "constitution"
  (`Agent.jobDescription`, injected into `buildSystemPrompt`, distinct from `persona`) +
  a **per-department permission matrix** (tool toggles grouped by functional area over
  the existing `getToolsForAgent` hard gate, incl. cross-department) + a **"justification
  test"** callout in the creation UX.
- **Phase 2 — Skills:** a composable skills system (OpenClaw-class, more organized).
- **Phase 3 — Orchestration:** internal event bus + `delegate_to_agent` /
  `request_from_agent` / `depends_on`, autonomous via the scheduler.
- **Phase 4 — Ops command center:** bookings calendar + agent scheduled-task calendar +
  task-tracking page. See `docs/AGENT_SYSTEM.md`.

### ✅ Shipped this session (2026-07-08)
- **Three environments** via `APP_ENV` (`lib/env.ts`, dev/staging/prod) + boot
  guardrails · **Sentry** (no-op without DSN) · **`GET /api/health`**.
- **Per-tenant email (Resend)** — central account + per-tenant sender
  (name/reply-to/marketing gate); wired welcome + order confirmation.
  `lib/notifications/tenant-email.ts`. **Pending (pro tier):** verified custom sending
  domain, billing receipts.

### Customer-facing arc: mobile dashboard + wallet + services marketplace
Decided 2026-06-21. Three phases:
1. **Mobile dashboard redesign — DONE.** Phone-first chrome: a swipeable
   horizontal **section carousel** under the topbar (`mobile-section-carousel.tsx`)
   + a fixed **bottom tab bar** with primary sections and a "More" sheet
   (`mobile-tabbar.tsx`, reuses `SidebarNav`). Safe-area + RTL aware; replaced the
   hamburger drawer. `NAV_SECTIONS` exported from `sidebar.tsx` as the single source.
2. **Wallet + Tap top-up — DONE.** `Wallet` (SAR balance) + `WalletTransaction`
   ledger, separate from the token bank. Dashboard `/wallet` page: balance, top-up
   presets, buy token credits, history. Top-up via **Tap.company** (`lib/payments/tap.ts`
   → hosted charge; `app/api/payments/tap/webhook` + return-page reconcile, both
   re-verifying the charge server-side; idempotent settle). Token-credit purchase
   debits the wallet and credits `Company.tokenBalance` atomically at the
   admin-set `PlatformSettings.tokenPricePerMillion`. **Pending:** set live
   `TAP_SECRET_KEY` in the host env to enable real charges (test keys work now).
3. **Services marketplace (internal add-ons) — DONE (structure).** New
   `MarketplaceService` + `ServicePurchase` models (distinct from the tenant
   `Service`). Admin CRUD at `/admin/services` (title/desc EN+AR, price, icon,
   category, active, sort). Customer `/services` page lists active offerings and
   buys with the wallet (atomic debit + ledger + purchase record;
   `lib/marketplace.ts`). Additive migration 20260621140000_marketplace.
   **Deferred (later phase):** activation logic, plugins/add-ons that actually
   change platform behavior, recurring/subscription services.


### Infrastructure migration → Google Cloud Run (DECIDED) — strategic
**Decision (2026-06-21):** the next infra home is **Google Cloud Run**, because
the AI runs on Google Vertex (Gemini) — Cloud Run sits inside Google's network
(low-latency Gemini/embeddings), authenticates to Vertex via **native ADC** (no
key files), autoscales, and **scales to zero** (no traffic = no bill). Full plan
and readiness checklist in **`docs/INFRA.md`**. Prep before going fully serverless:
1. **Scheduler** → **Cloud Scheduler** → `POST /api/cron/run` (endpoint exists).
2. **Rate-limit + queue** → **Memorystore (Redis)** (in-memory limiter is
   single-instance today; needed across replicas + for a BullMQ worker at scale).
3. **DB** → Cloud SQL Postgres (enable `vector`); **PgBouncer** (tx mode) for pooling.
4. **Secrets/role** → Secret Manager + a least-privilege `Vertex AI User` SA.
The app is already container-ready (`output: 'standalone'` + Dockerfile) and
provider-portable (DB/storage/AI via env). Also do **CDN via Cloudflare** now
(`docs/INFRA.md`): proxy `bznss.one`, R2 custom domain for assets.

### Deep-component i18n → English-primary — NEXT
The redesign flipped the default to English and migrated the shell, onboarding,
settings, overview, full CRM, and all section-page headers. **Remaining: the deep
interactive components still have hardcoded Arabic** and need the same pass
(extract → `messages/{en,ar}.json` → `useTranslations`/`getTranslations`):
`order-manager`, `product-form`, `faq-manager`, `trigger-manager`, `task-manager`,
`department-manager`, `modules-manager`, the dashboard **chat**, the agent
create/edit deep fields, and the **public landing page** (`app/(public)/[slug]`).

### Fully enforce RLS
RLS is enabled+forced but **permissive when no tenant is pinned** — it only
isolates inside a `withTenant()` tx (`lib/db-tenant.ts`). Adopt `withTenant`
across tenant queries, then drop the permissive `IS NULL` fallback to fully
enforce. Today only the HR hire flow pins the tenant.

### `CART_ABANDONED` dispatch source
The event + scenarios exist but nothing fires it (no cart/checkout-intent model).
Add cart/checkout-intent capture (or an external integration) that calls
`dispatchEvent(companyId, 'CART_ABANDONED', …)`.

### Super Admin dashboard (SaaS management)
**Core DONE (2026-06-21):** `app/(admin)/admin` guarded by `SUPER_ADMIN`
(`lib/admin.ts`) — overview totals, companies list+usage+search, company detail
(token top-up, change plan → re-applies per-agent caps, suspend/activate), and a
platform-settings editor (`PlatformSettings`); `signupEnabled` gates the signup
route; admin actions log to `AuditLog`; "Admin panel" link in the user menu, and a
company-less super-admin is routed to `/admin`. Actions in `lib/actions/admin.ts`.
**Still TODO:** impersonate-for-support, audit-log viewer UI, usage charts /
revenue, invoices, a DB Plan-catalog editor (plans are defined in code today via
`lib/plans.ts`), maintenance-mode app-wide wiring, and 2FA for admin.

### Chat latency — remaining levers
Diagnosed causes: vector recall + full model generation (incl. Gemini 2.5
"thinking") + occasional multi-round tool loops, all felt at once with no
streaming. **Done:** SSE streaming (token-by-token — biggest perceived win);
fast tier is already the agent default (`HAIKU`→`gemini-2.5-flash`); **thinking
budget capped** (`VERTEX_THINKING_BUDGET`, default 0 = off) to kill the pre-answer
reasoning delay + token burn. `MAX_TOOL_ROUNDS=5` left as-is (it's a worst-case
cap, not the typical path — most chats use 0–1 rounds). **Remaining lever:**
**Context Caching** — the static system prompt + tool schemas are re-sent every
call; cache them via Vertex `cachedContent` (SDK 1.12 already supports it → switches
to `v1beta1`) to cut input latency + cost. Needs the prompt split into a static
(cacheable) prefix vs the dynamic memory-recall suffix, plus per-agent cache TTL.

### File storage (see `docs/STORAGE.md`)
Core in place (hybrid rule: file→R2, URL→text, vectors→pgvector, **no bytes in
DB**; per-tenant prefix; presigned direct uploads; provider-agnostic; CDN).
**DONE:** central `File` registry (RLS) + **per-tenant storage quota** (per-plan
ceilings + admin per-tenant override + 403 on over-quota + atomic reserve/release
+ `/admin/plans` telemetry). **Remaining:**
1. **Private/confidential files** — private bucket/prefix served only via
   short-lived `createDownloadUrl` + per-file access checks (customer docs).
2. **Server-side size cap** — presigned PUT → presigned POST with a
   `content-length-range` policy (today: client-reported size only).
3. **Orphan cleanup + reconcile** — periodic job over the `File` registry.
4. **"Buy extra storage" add-on** — a marketplace service that bumps
   `storageLimitBytes` on purchase (the upgrade path the 403 hints at).

### Payments — Tap.company
Token-bank top-ups (DONE), marketplace (DONE), and **subscriptions (DONE)**:
`/subscription` shows the current plan, upgrade options (Plan catalog seeded in
DB), and invoices. Renew/upgrade offers two methods — **pay from wallet** (atomic
debit, shows balance) or **Tap card / Apple Pay** (hosted charge, settled
idempotently on webhook/return via `lib/billing/subscription.ts`). Activation
syncs `Company.plan` + per-agent token cap and writes a PAID `Invoice`.
**Still future:** recurring/auto-renew (Tap subscriptions API), invoice PDFs,
proration on mid-cycle upgrades, a DB Plan-catalog editor in the admin (plans are
seeded; editing still needs UI).

### Other
- **Landing redesign (DEFERRED — after the platform is functional):** level up the
  marketing landing (`app/page.tsx`) into a product-led feature showcase inspired by
  `attio.com/platform/ask` — analyze its hero + the below-hero feature-showcase pattern
  and adopt both for iWork's real features. English/Arabic, RTL, Aurora.
- Bookings module: interactive calendar + business-hours/availability + manual create.
- Per-trigger conditions (e.g. cart-value thresholds in `abandoned_cart` scenarios).
- Email pro tier: verified custom sending domain (Resend Domains API) + billing receipts.
- Public API v1 (API keys per company) for third-party integrations.
- Security hardening: rate limiting (shared store), 2FA for admin.
- Replace prod GCP `Owner` grant with least-privilege `Vertex AI User`.

## ✅ Done (highlights)
See `CHANGELOG.md` for the full log. Core platform complete: provider-agnostic →
Vertex (managed, ADC keyless, token bank) · agents/departments/persona · task
engine · scheduler + event triggers · semantic memory · modular architecture
(e-commerce/services/bookings + dynamic tools) · CRM · catalog · FAQ · R2 storage
· notifications · public landing page + agent widget + order flow.

**2026-06-20 arc** (see `CHANGELOG.md` / `docs/CONTINUE_HERE.md`): per-tenant
reference codes · English-primary redesign (sidebar, onboarding, settings,
overview, CRM, section pages) · **HR Agent lifecycle system** (9 templates, hybrid
create, conflict-check, cognitive onboarding, onboarding→active, org chart,
`/api/hr/deploy`, advisory mode, scenario builder) · complaint sentiment +
Telegram escalation · per-agent token cap by plan · RLS (permissive-fallback;
adopt `withTenant` to fully enforce).

**2026-06-21 arc** (see `CHANGELOG.md`, `docs/ADMIN.md`, `docs/AGENT_SYSTEM.md`,
`docs/INFRA.md`): **Aurora design system** + responsive mobile nav + delight ·
**professional conversion landing** (coded mockups, pricing, FAQ, JSON-LD/SEO,
light-default, auth-aware nav) · **Super Admin console (core)** · production
hardening (**AI rate-limiter**, **per-agent tool permissions**, HNSW vectors) ·
**token-bank fix** (5M default + restore + diagnostic log) · **streaming chat (SSE)**
· **internal vs customer conversation modes** · CDN headers + Cloudflare/Cloud-Run
docs.
