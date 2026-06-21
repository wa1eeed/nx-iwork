# Super Admin Console — Platform Operations

> The platform-owner control plane (separate from the business-owner dashboard).
> Built 2026-06-21. Route group `app/(admin)/admin`. Audience: the platform owner
> only (`SUPER_ADMIN`). For the SaaS roadmap beyond the core, see `docs/TODO.md`.

## Access & security

- **Role:** `UserRole.SUPER_ADMIN` (in the session JWT — see `lib/auth.ts`),
  granted by the env bootstrap (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), the
  `SUPER_ADMIN_EMAILS` allowlist, or the DB flag (all under *Becoming a super
  admin* below).
- **Guard:** `requireSuperAdmin()` / `isSuperAdmin()` in `lib/admin.ts` (a cheap
  session check, no DB round-trip) — honors both the role and the env allowlist.
  The `app/(admin)/admin/layout.tsx` calls it and `redirect('/overview')`s anyone
  who isn't a super admin.
- **Middleware:** `/admin` is in `PROTECTED_PREFIXES` (auth-gated); the role gate
  lives in the layout.
- **Routing in:** a company-less super admin hitting `/overview` is redirected to
  `/admin` (dashboard layout); there's also an "Admin panel" link in the user
  menu for super admins.
- **Every mutation is audited** → `AuditLog` (action, userId, companyId, metadata).

### Becoming a super admin

Three paths — any one grants access; pick whichever fits:

**A) Full credentials from env (bootstrap — creates the account).** The admin
email defaults to **`waleed@nx.sa`** (override with `ADMIN_EMAIL`). Going live is
two steps: **deploy**, then set **`ADMIN_PASSWORD`** in the host env and restart —
on boot the account is created (or its password/role reconciled) as `SUPER_ADMIN`
and you sign in normally at `/admin`. No prior signup needed; changing env +
redeploy re-applies (Coolify runs `node server.js`, which fires the boot hook).
```bash
# .env / Coolify env — only the password is required
ADMIN_PASSWORD="set-a-strong-password"
# ADMIN_EMAIL="waleed@nx.sa"      # optional override; this is the default
# ADMIN_NAME="Administrator"      # optional, default "Administrator"
```
Logic: `instrumentation.ts` `register()` → `lib/seed-admin.ts`
`seedAdminFromEnv()`. **No default password** — the seed is a no-op until
`ADMIN_PASSWORD` is set, so a fresh deploy never ships a guessable credential.
The password is stored **bcrypt-hashed** (rounds = 12, matching signup) and only
re-hashed when it actually changes. Because env is the source of truth, a UI
password change on this account is overwritten on the next restart — expected
for an env-managed bootstrap admin.

**B) Env allowlist (elevate an existing account by email).** Add email(s) to
`SUPER_ADMIN_EMAILS` (comma-separated) + redeploy; on next login that account is
elevated. Emails only — the account keeps its own password. Logic:
`lib/admin-allowlist.ts` → applied in `lib/auth.ts` (role at login) and OR-ed
into the guards (`lib/admin.ts`).
```bash
SUPER_ADMIN_EMAILS="you@example.com,ops@bznss.one"
```

**C) DB role (permanent flag on the row).**
```bash
npx tsx scripts/make-admin.ts you@example.com
# or: UPDATE "User" SET role='SUPER_ADMIN' WHERE email='you@example.com';
```

**Security:** the only secret that belongs in env is `ADMIN_PASSWORD` (path A),
and it is hashed at rest — keep it in a secrets manager and rotate by editing
the env. Paths B/C never involve passwords. Then open `/admin` and sign in.

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
