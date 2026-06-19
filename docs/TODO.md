# TODO — NX iWork

Tracked follow-ups beyond the current build. Newest first.

## 🔜 Planned

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
- Event triggers: more events (ORDER_PAID wiring) + per-trigger conditions.
- Observability: Sentry integration.
- Public API v1 (API keys per company) for third-party integrations.
- Security hardening: rate limiting (shared store), Postgres RLS, 2FA for admin.
- Migrate `@google-cloud/vertexai` → `@google/genai` before its 2026 removal.
- Replace prod GCP `Owner` grant with least-privilege `Vertex AI User`.

## ✅ Done (highlights)
See `CHANGELOG.md` for the full log. Core platform complete: provider-agnostic →
Vertex (managed, ADC keyless, token bank) · agents/departments/persona · task
engine · scheduler + event triggers · semantic memory · modular architecture
(e-commerce/services/bookings + dynamic tools) · CRM · catalog · FAQ · R2 storage
· notifications · public landing page + agent widget.
