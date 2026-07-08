# 🚀 START HERE — NX iWork

> **Resuming work?** Read [`docs/CONTINUE_HERE.md`](docs/CONTINUE_HERE.md) first — it
> has the current state, what's next, and the invariants. This file is the short
> orientation; the detail lives in [`docs/`](docs/README.md).

## What NX iWork is

A production, multi-tenant SaaS that lets an entrepreneur build a company staffed by
**autonomous AI-agent "employees"** organized by department. **Live at
[bznss.one](https://bznss.one/)** (single domain, path-based: `/`, `/overview`,
`/admin`, `/{slug}`).

**North star:** an operations-management platform for *any* business, staffed by AI
agents per department, with trigger control and inter-agent collaboration, working
without owner intervention.

**The two-layer contract** (governs all agent design):
- The **system** (deterministic code inside workflows) owns transactions — invoices,
  bookings, orders, CRM records — programmatically and reliably.
- **Agents** do the human work — judgment, natural-language communication (with
  customers and each other), ambiguity, initiative, cross-department coordination. An
  agent perceives system state, decides within policy, communicates, and *triggers*
  workflows; it never "registers the invoice" — the system does that.

## Stack

- **Frontend/Backend:** Next.js 16 (App Router, strict TS, `output: 'standalone'`),
  Prisma, PostgreSQL 16 + pgvector. NextAuth v5. next-intl v3 (**English-primary**,
  Arabic secondary, RTL). Tailwind + shadcn/ui + framer-motion (Aurora design, light
  default). Mobile-first dashboard.
- **AI:** **managed Vertex AI** (keyless ADC) metered by a **token bank**
  (`Company.tokenBalance`); BYOK is an optional fallback. SDK is
  `@google-cloud/vertexai` (**not** `@google/genai`). Models `gemini-2.5-flash` /
  `gemini-2.5-pro`; embeddings `gemini-embedding-001` (1536-dim, HNSW). See
  [`docs/AI_VERTEX.md`](docs/AI_VERTEX.md).
- **Storage:** Cloudflare R2 (S3-compatible, provider-agnostic). **Hybrid principle:**
  bytes → R2, URL → a text column, embeddings → pgvector; never store file bytes in
  Postgres. See [`docs/STORAGE.md`](docs/STORAGE.md).
- **Payments:** Tap.company (wallet top-ups + subscriptions). **Email:** Resend
  (central account + per-tenant sender). **SMS:** Twilio (optional). **Escalation:**
  Telegram.
- **Deploy:** Docker on **Coolify** (VPS). Cloudflare CDN in front.

## Invariants (don't relearn these the hard way)

- **Deploy = push to `origin/main`** → Coolify runs `prisma migrate deploy && node
  server.js`. Keep migrations **additive**. `main` is the deploy branch.
- **Three environments** via `APP_ENV` (`lib/env.ts`): development (local) · staging
  (VPS) · production (live). Use `sk_test_` Tap keys off production, `sk_live_` only on
  production. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **All agent creation goes through the HR gateway**
  (`hrAgent.onboardAndDeployAgent` / `createAgent` / `createAgentFromTemplate`) — never
  `db.agent.create` directly (you'd skip conflict-check, onboarding, scenarios,
  permissions, token cap).
- **Tool permissions are a hard gate:** `getToolsForAgent` = module ∩ `Agent.permissions`
  (empty = all module tools). The model can never call a tool it wasn't handed.
- **Conversation modes:** dashboard/tasks = `internal` (agent talks to the owner as its
  employee); public widget = `customer`.
- **AI auth** is keyless ADC via `GOOGLE_APPLICATION_CREDENTIALS_JSON`. Don't reintroduce
  inline `GCP_CLIENT_EMAIL`/`GCP_PRIVATE_KEY`.
- **Never commit secrets/`.env` files** — only `.env.example` with placeholders. BYOK
  keys are encrypted (AES-256-GCM). Super-admin is bootstrapped from env
  (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, bcrypt).
- **Verify before commit:** `npm run type-check && npm run build`. Commit messages end
  with the `Co-Authored-By: Claude …` trailer.
- **Latin digits everywhere**, no thousands-separator in prices.

## The docs map

| Doc | What it's for |
|-----|---------------|
| [`docs/CONTINUE_HERE.md`](docs/CONTINUE_HERE.md) | Current state + what's next (read first when resuming) |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Project constitution: vision, principles, decisions |
| [`docs/AGENT_SYSTEM.md`](docs/AGENT_SYSTEM.md) | The agent system + the multi-agent direction |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema reference |
| [`docs/STORAGE.md`](docs/STORAGE.md) | File storage architecture |
| [`docs/AI_VERTEX.md`](docs/AI_VERTEX.md) | AI layer (managed Vertex) |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/INFRA.md`](docs/INFRA.md) | Deploy + infra/scaling |
| [`docs/ADMIN.md`](docs/ADMIN.md) | Super-admin console |
| [`docs/TODO.md`](docs/TODO.md) · [`docs/ROADMAP.md`](docs/ROADMAP.md) | Backlog + forward roadmap |
| [`CHANGELOG.md`](CHANGELOG.md) | Historical log (append-only) |
