# Changelog

All notable changes to NX iWork are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

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
