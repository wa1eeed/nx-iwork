# Contributing to NX iWork

Engineering guide: how to set up, the conventions we hold, and the invariants you
must not break. Pairs with [`docs/README.md`](./docs/README.md) (the doc map) and
[`docs/CONTINUE_HERE.md`](./docs/CONTINUE_HERE.md) (current state).

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 16 with the `vector`, `pg_trgm`, `pgcrypto` extensions
- (For AI) a Google Cloud project with Vertex AI enabled + ADC credentials

## Local setup

```bash
git clone <repo> && cd nx-iwork
npm install --legacy-peer-deps          # next-auth beta vs next 16 peer ranges
cp .env.example .env                     # then fill DATABASE_URL, NEXTAUTH_SECRET, …
npx prisma generate
npx prisma migrate deploy                # apply migrations to your DB
npm run dev                              # http://localhost:3000
```

For visual previews without a DB, a gitignored `.env.local` with a dummy
`AUTH_SECRET` lets the dev server boot (the dashboard still needs a DB).

## Project layout

See the root [`README.md`](./README.md#-هيكل-المشروع). In short: `app/` (App
Router), `lib/ai/` (neutral AI layer), `lib/agent/` (the engine), `lib/storage/`,
`lib/actions/`, `prisma/`, `docs/`.

## Workflow & conventions

- **Deploy = push to `origin/main`** (Coolify builds the Dockerfile, runs
  `prisma migrate deploy` then the app). `main` is the deploy branch.
- **Verify before every commit:** `npm run type-check && npm run build`.
- **Commits** end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and use a
  `type(scope): subject` summary (`feat`, `fix`, `refactor`, `docs`, `perf`).
- **Migrations are additive.** Never edit a shipped migration; add a new one.
  Record schema additions in [`docs/DATABASE.md`](./docs/DATABASE.md).
- **i18n:** every user-facing string goes through `next-intl`
  (`messages/{en,ar}.json`); never hardcode. English is primary, Arabic secondary,
  RTL-aware.
- **Docs track code:** changing the schema / AI layer / storage / admin updates
  the matching reference doc in the same change.

## Invariants — don't break these

- **All agent creation goes through the HR gateway** (`hrAgent.onboardAndDeployAgent`
  / `createAgent`), never `db.agent.create` — you'd skip conflict-check,
  onboarding, scenarios, permissions, and the token cap.
- **Hybrid principle:** customer-facing transactions are deterministic **code**
  (`/api/public/[slug]/order` → `Order`). Agents are the augmentation layer,
  acting only via **function-calling tools** gated by `Agent.permissions`. Never
  mutate from raw model text.
- **Conversation modes** (`buildSystemPrompt` `audience`): dashboard/tasks =
  `internal` (the owner is the agent's manager); public widget = `customer`.
- **Token bank:** charge the real `usageMetadata.totalTokenCount`; default grant
  5,000,000 (`Company.tokenBalance`). No custom token math.
- **Storage hybrid rule:** file body → R2; URL → a plain text column; embeddings →
  pgvector. **Never store file bytes in Postgres.** See
  [`docs/STORAGE.md`](./docs/STORAGE.md).
- **Numbers are Latin digits** everywhere (`lib/format.ts`); prices have no
  thousands separator.
- **AI = `@google-cloud/vertexai`** (managed Vertex + keyless ADC), **not**
  `@google/genai`. Embeddings = `gemini-embedding-001` (1536 dims).
- **Admin** is `SUPER_ADMIN`-only (`lib/admin.ts`); see [`docs/ADMIN.md`](./docs/ADMIN.md).
- **Light theme** is the default.
- **Secrets** live only in env — never commit `.env*` (only `.env.example`).
  Don't reintroduce inline GCP keys; use ADC JSON.

## RLS note

Row-Level Security is enabled+forced but **permissive when no tenant is pinned**
— it only isolates inside a `withTenant()` tx (`lib/db-tenant.ts`). App-level
`companyId` scoping is the live guard. Don't assume the DB isolates un-pinned
queries yet.
