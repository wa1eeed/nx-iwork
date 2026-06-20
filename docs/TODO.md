# TODO — NX iWork

Tracked follow-ups beyond the current build. Newest first.
**Resuming? Start with `docs/CONTINUE_HERE.md`.**

## 🔜 Planned

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

### Super Admin dashboard (SaaS management) — HIGH
A platform-owner console (separate from the business-owner dashboard) to run the SaaS:
- **Subscriptions & billing**: view/manage each company's plan, token-bank top-ups
  (Tap.company), invoices, trial/expiry, suspend/reactivate.
- **Customer management**: list companies, usage (tokens, agents, tasks), drill-in,
  impersonate for support, suspend/delete.
- **Platform settings**: feature flags, default token grants, maintenance mode,
  global branding.
- **Observability**: usage dashboards, token spend vs revenue, error rates (Sentry).
- Route group `app/(admin)/admin` · role `SUPER_ADMIN` (already in schema) · 2FA.
- Models mostly exist (`Plan`, `Subscription`, `Invoice`, `PlatformSettings`,
  `AuditLog`); needs the UI + admin actions + access guard.

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
