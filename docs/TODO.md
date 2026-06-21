# TODO — NX iWork

Tracked follow-ups beyond the current build. Newest first.
**Resuming? Start with `docs/CONTINUE_HERE.md`.**

## 🔜 Planned

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

### Payments — Tap.company
Token-bank top-ups + SaaS subscriptions. Closes the managed-billing loop.

### Other
- Bookings module: interactive calendar + business-hours/availability + manual create.
- Per-trigger conditions (e.g. cart-value thresholds in `abandoned_cart` scenarios).
- Observability: Sentry integration.
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
