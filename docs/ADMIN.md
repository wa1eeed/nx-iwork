# Super Admin Console — Platform Operations

> The platform-owner control plane (separate from the business-owner dashboard).
> Built 2026-06-21. Route group `app/(admin)/admin`. Audience: the platform owner
> only (`SUPER_ADMIN`). For the SaaS roadmap beyond the core, see `docs/TODO.md`.

## Access & security

- **Role:** `UserRole.SUPER_ADMIN` (in the session JWT — see `lib/auth.ts`).
- **Guard:** `requireSuperAdmin()` / `isSuperAdmin()` in `lib/admin.ts` (a cheap
  session check, no DB round-trip). The `app/(admin)/admin/layout.tsx` calls it
  and `redirect('/overview')`s anyone who isn't a super admin.
- **Middleware:** `/admin` is in `PROTECTED_PREFIXES` (auth-gated); the role gate
  lives in the layout.
- **Routing in:** a company-less super admin hitting `/overview` is redirected to
  `/admin` (dashboard layout); there's also an "Admin panel" link in the user
  menu for super admins.
- **Every mutation is audited** → `AuditLog` (action, userId, companyId, metadata).

### Becoming a super admin
```bash
npx tsx scripts/make-admin.ts you@example.com
# or on the server's Postgres console:
# UPDATE "User" SET role='SUPER_ADMIN' WHERE email='you@example.com';
```
Then open `/admin` and sign in with that account (it keeps its own password).

## Pages

| Route | What it does |
|---|---|
| `/admin` | **Overview** — platform totals: companies, AI employees, tasks run, total token credits (sum of `Company.tokenBalance`), companies-by-status, newest companies. |
| `/admin/companies` | **Companies** — searchable list (name / username) with plan, status, agent count, credits. |
| `/admin/companies/[id]` | **Company detail** — usage (agents/tasks/customers/credits), owner, joined date, public-page link, **+ actions** (below). |
| `/admin/settings` | **Platform settings** — global switches (below). |

## Actions (server actions in `lib/actions/admin.ts`, all `requireSuperAdmin`-gated)

- **`topUpTokens(companyId, amount)`** — add prepaid AI credits to a company's
  token bank. Bounded (`0 < amount ≤ 1e9`). Audited `admin.tokens.topup`.
- **`setCompanyPlan(companyId, tier)`** — change the plan (`PlanTier`). **Also
  re-applies the per-agent monthly token cap** to all the company's agents
  (`agentTokenCap(tier)`), so the new plan takes effect immediately. Audited
  `admin.plan.change`.
- **`setCompanyStatus(companyId, status)`** — `ACTIVE | SUSPENDED | TRIAL |
  EXPIRED`. `SUSPENDED` companies are already blocked from the public chat + order
  flow (status checks exist there). Audited `admin.status.change`.
- **`updatePlatformSettings(data)`** — upserts the `PlatformSettings` singleton
  (`id='singleton'`). Audited `admin.settings.update`.

### Platform settings (the singleton)
- `siteName` — display name.
- `signupEnabled` — **wired**: when off, `POST /api/auth/signup` returns 403
  `signups_disabled` (closes registrations globally).
- `trialEnabled`, `trialDays` — trial config.
- `maintenanceMode`, `maintenanceMessage` — stored (app-wide wiring is a TODO).
- `maxCompaniesAllowed` — cap on tenants (blank = unlimited; enforcement TODO).

## Still TODO (admin Phase 2 — see `docs/TODO.md`)
Impersonate-for-support · audit-log viewer UI · usage/revenue charts · invoices ·
a DB plan-catalog editor (plans are defined in code today via `lib/plans.ts`) ·
maintenance-mode app-wide wiring · 2FA for admin.

## UI components
`components/admin/admin-nav.tsx` (sidebar nav, active state),
`company-actions.tsx` (top-up / plan / status, client),
`platform-settings-form.tsx` (settings editor, client). The shell reuses the
Aurora design language (glass sidebar + a "Super admin" badge).
