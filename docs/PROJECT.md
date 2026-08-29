# NX iWork - Project Constitution

> **This file is the first and foundational reference for the project.** Read it in full before any development.

---

## 1. Overview

**Name:** NX iWork

**Description:** A platform that lets business owners build an entire company of AI employees who work across departments, execute tasks, and have long-term memory.

**Business model:** **Managed SaaS** — now live at **bznss.one**. Monthly subscriptions
(Starter/Growth/Scale plans) + a managed **token bank** for AI + a **wallet** (SAR) + a
**services/add-ons marketplace**. (The old "sell licensed copies" direction was replaced by managed SaaS.)

**Market:** Saudi Arabia first, then the Gulf, then global.

**Languages:** Arabic (Tajawal) + English (Inter), can be turned off from Settings.

---

## 2. Core values

1. **Simplicity for the business owner** - the entrepreneur is non-technical
2. **Replicability** - an architecture that supports selling copies effortlessly
3. **Security first** - encryption, isolation, 2FA
4. **Full flexibility** - everything is customizable (language, currency, date, theme)
5. **Real intelligence** - smart employees with memory, not chatbots

---

## 3. Tech Stack

### Frontend
- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Tajawal + Inter fonts
- next-intl for translation
- framer-motion for animations
- lucide-react for icons

### Backend
- Next.js API Routes + Server Actions
- Prisma ORM
- PostgreSQL 16 + pgvector (for semantic memory)
- NextAuth.js v5
- bcryptjs

### AI (Provider-Agnostic)
- **Neutral layer** (`lib/ai/`) — a unified interface; the rest of the code never imports any provider SDK
- **Managed by default via Google Vertex** (Gemini 2.5) with **keyless ADC** authentication,
  and billing via a per-company **token bank**. **BYOK** is optional (the company's key is encrypted,
  Gemini/Claude). See [`AI_VERTEX.md`](./AI_VERTEX.md).
- **Function Calling:** agents execute tools (catalog, CRM, tasks) instead of just chatting — structured reads instead of PDFs to save tokens
- Abstract model tiers (Fast/Balanced/Advanced) map to a per-provider model id (`lib/ai/models.ts`)

### Integrations (isolated neutral layers — building any one doesn't touch the others)
- **Cloudflare R2** (S3-compatible storage, direct presigned uploads that bypass the VPS, hybrid approach + quota + image compression) — `lib/storage/` ✅
- **Resend** (central email + **per-tenant sender**: name/reply-to/marketing) + **Twilio** (optional SMS) + Telegram (escalation) — `lib/notifications/` ✅
- **Embeddings** (Google Gemini `gemini-embedding-001` @ 1536, HNSW) for semantic memory — `lib/ai/embeddings.ts` ✅
- **Tap.company** (wallet top-up + subscription payment by card/Apple Pay) — ✅ implemented (auto-renewal planned)
- **Sentry** (error tracking, tagged with `APP_ENV`) + `GET /api/health` + **three environments** via `APP_ENV` (`lib/env.ts`) — ✅ implemented
- **Public API v1** for third-party integration — planned

### DevOps
- Docker (multi-stage)
- Coolify (self-hosted PaaS)
- Caddy (reverse proxy + auto SSL)
- GitHub + Actions

---

## 4. Roles in the system

### 1. Super Admin (Waleed)
- Access to everything via `/admin` (the super-admin panel — see [`ADMIN.md`](./ADMIN.md))
- Manage companies, plans, token balances, storage caps, platform settings
- Managed credentials (Vertex) via a single service account — no exposed API keys

### 2. Business Owner
- The company owner (the subscriber)
- The dashboard on `bznss.one` (routes `/overview`, `/agents`, …)
- Adds employees, departments, services, products

### 3. Business Member
- A human employee at the company
- Limited permissions as defined by the Owner

### 4. AI Agent
- Not a user; an entity inside the system
- Has a persona, memory, permissions

### 5. Visitor
- A visitor to the public site (`bznss.one/{slug}` or the company's custom domain)
- Interacts with AI Agents via the chat widget

---

## 5. Core features

### For the Business Owner

**Employee management:**
- Create an AI Agent with a persona and roles
- Link to a department and manager
- Give it a System Prompt + Skills
- Monitor performance (3 tabs + Timeline)

**Task management:**
- Assign a task to an employee
- Track progress
- Review the result
- Approvals for sensitive decisions

**Chat:**
- Direct chat with any employee
- Streaming from Claude
- Long-term memory

**Settings (Configurable):**
- Language: Arabic/English/both
- Currency: SAR/USD/AED/EUR/GBP
- Date: Gregorian/Hijri/both
- Timezone: Asia/Riyadh and others
- Theme: Dark/Light
- Branding: logo, colors, name

**Public front end:**
- A unified, customizable landing page
- Hero (text+image or slider)
- Services (with visitor requests)
- Products (with cart + checkout)
- Chat widget in the corner
- Custom Domain support

### For the Super Admin

**Dashboard:**
- Total revenue
- Active customers
- System usage

**Customer management:**
- List, details, suspend, delete

**Platform settings:**
- Global branding
- Feature flags
- Maintenance mode

---

## 6. Architectural decisions

### Decision 1: Multi-tenancy from day one
**Decision:** Shared Database, Shared Schema with `companyId` isolation
**Why:** supports the dual model (copies + SaaS) with the same code

### Decision 2: Dual AI model — Managed (default) + BYOK (optional)
**Decision:** the default is **managed**: the platform connects to **Google Vertex** (Gemini 2.5) via a single service account and **keyless ADC** authentication, and bills each company via a **token bank** (`Company.tokenBalance`) — the platform pays Google. **BYOK** is optional: the company supplies its own key (AES-256-GCM encrypted), picks the provider (Gemini/Claude), and pays directly.
**Why:** managed gives a ready-to-use experience with no customer setup, and the platform controls cost via the token bank; BYOK remains for those who want their own key/provider (the cost is theirs). The layer is neutral (`lib/ai/`), so switching = one file.
**⚠️ Decision update:** the direction used to be **BYOK-first**; we moved to **managed-first via Vertex + token bank** after adopting Google's keyless policy and the managed-SaaS model. Current reference: [`../README.md`](../README.md) and [`AI_VERTEX.md`](./AI_VERTEX.md).

### Decision 2b: A flexible data model for any business
**Decision:** fixed core tables (Customer/Service/Product/Task) + a `customFields` (JSON) field on each
**Why:** a given business (real estate/bookings/services/stores) adds its own attributes (number of rooms, arrival time, budget) with no change to the schema or code.

### Decision 2c: A unified task system (list/calendar)
**Decision:** a single `Task` table with kinds (`TaskKind`: AGENT_TASK / APPOINTMENT / REMINDER) + `startAt/endAt`
**Why:** serves agent tasks, customer appointments, and reminders together, is shown as a list or calendar, and links to the CRM.

### Decision 3: The advanced Agent Loop
**Decision:** every employee has:
1. **Working Memory** (the last 20 messages in context)
2. **Episodic Memory** (all tasks in the DB)
3. **Semantic Memory** (vector embeddings in pgvector)
4. **Wake Triggers** (events that wake it: a task, a message, a schedule, a webhook)

### Decision 4: Skills & Tools System
**Decision:** every employee has Tools (executable tools via function-calling) + Skills (composable capabilities)
- Tools: **direct internal** tools (catalog, CRM, tasks, memory) gated through `getToolsForAgent` (module ∩ `permissions`) — the model cannot reach any tool it wasn't handed (a strict gate).
- Skills: specialized composable capabilities — the **Skills system is planned** (phase 2 of the agent architecture).

### Decision 5: The two-layer contract (system vs. agents)
**Decision:** the **system** (deterministic code inside the workflow) owns transactions — invoices, bookings, orders, CRM records — programmatically and reliably. The **agents** do the human work: judgment, natural-language communication (with customers and among themselves), ambiguity, initiative, cross-department coordination. The agent is aware of the system's state, decides within policy, communicates, and **triggers** the workflow — but does not "record the invoice" itself (the system does that).
**Why:** prevents redundant agents — each agent is justified only where judgment/communication/initiative are needed. (Replaces the old, cancelled n8n decision; the core tools are internal, not external.)

### Decision 6: Configurable Settings
**Decision:** everything is customizable from Settings:
- Language (en/ar/both)
- Currency + date + timezone
- Theme
- Branding
**Why:** supports selling copies with different branding, and eases global expansion

### Decision 7: The model = multi-tenant SaaS + three environments
**Decision:** the live platform is **multi-tenant SaaS** (isolation via `companyId` + RLS), running across **three environments** (development/staging/production) distinguished by `APP_ENV` (`lib/env.ts`) — because `NODE_ENV` doesn't separate staging from production. A single instance on bznss.one, path-based routes.
**Why:** a single centrally managed model, with environments that isolate secrets/keys (test vs. live). (Single-tenant mode is no longer implemented in the code.)

### Decision 8: Custom Domain Support
**Decision:** the customer points their domain (an A-record for the apex) and the platform verifies it and serves `/{slug}` on it; SSL is managed via Coolify/Caddy.
**Why:** the business owner connects their own domain easily.

### Decision 9: Data Sovereignty
**Decision:** all data on a VPS in Saudi Arabia
**Why:** requirements of the Saudi market and Vision 2030

---

## 7. Project structure

```
nx-iwork/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication
│   │   ├── login/
│   │   ├── signup/
│   │   └── onboarding/
│   ├── (dashboard)/              # Business Owner dashboard
│   │   ├── overview/
│   │   ├── agents/
│   │   ├── departments/
│   │   ├── tasks/
│   │   ├── chat/
│   │   ├── orders/
│   │   ├── services/
│   │   ├── products/
│   │   └── settings/
│   ├── (admin)/                  # Super Admin panel
│   │   └── admin/
│   ├── (public)/                 # Public page
│   │   └── [businessSlug]/
│   ├── api/
│   └── page.tsx                  # marketing landing (/) + SEO/JSON-LD
├── components/
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── claude/                   # Agent Loop logic
│   ├── memory/                   # 3-layer memory system
│   ├── encryption.ts
│   ├── i18n/
│   └── tenant.ts                 # Multi-tenant helpers
├── prisma/
├── public/
├── styles/
├── tests/
├── docker/
└── docs/
```

---

## 8. Development principles

1. **One feature at a time** - we don't build features in parallel
2. **Test before moving on** - each feature works before the next
3. **Git after every feature** - small, clear commits
4. **Immediate documentation** - CHANGELOG.md kept up to date
5. **Ask before big decisions** - Waleed must approve

---

## 9. Expected costs

### To start:
- VPS Coolify: 100 SAR/month
- Domain (bznss.one): ~200 SAR/year
- Claude API (BYOK from customers): 0
- **Total: ~120 SAR/month**

### After selling 5 copies:
- Revenue: 200,000+ SAR
- Fixed costs: 500 SAR/month
- **Profit margin: ~98%**

---

## 10. Implementation status (done)

The platform's core is **complete and deployed**:

| Capability | Status | Location |
|---|---|---|
| Neutral AI layer (Vertex/Gemini managed by default, BYOK optional) | ✅ | `lib/ai/` |
| Managed mode: Vertex AI + token bank (`AI_MODE=managed`, **default**) | ✅ verified live | `lib/ai/providers/vertex.ts`, `lib/billing/tokens.ts` — ref: `docs/AI_VERTEX.md` |
| Agent chat + tool calling (catalog/CRM/tasks/memory) | ✅ | `lib/agent/run.ts`, `tools.ts` |
| Flexible data model: CRM (Customer) + customFields + unified Task | ✅ | `prisma/schema.prisma` |
| Department and agent management + persona building | ✅ | `app/(dashboard)/agents`, `departments` |
| Task execution engine (lifecycle + attempts + Timeline) | ✅ | `lib/agent/task.ts`, `core.ts` |
| Triggers and scheduling (standalone worker) | ✅ | `lib/agent/scheduler.ts`, `scripts/scheduler.ts` |
| Memory (semantic via pgvector + fallback) | ✅ | `lib/agent/memory.ts`, `lib/ai/embeddings.ts` |
| R2 storage + product catalog | ✅ | `lib/storage/`, `app/(dashboard)/products` |
| Notifications: per-tenant email (Resend) + SMS (Twilio optional) + escalation (Telegram) | ✅ | `lib/notifications/`, `tenant-email.ts` |
| Public landing page + agent widget | ✅ | `app/(public)/[slug]` |
| Marketing landing + SEO/JSON-LD on `/` | ✅ | `app/page.tsx` |
| Mobile design (department carousel + bottom bar) | ✅ | `components/dashboard/mobile-*` |
| CRM: opportunities (Pipeline/Kanban + 360°) + orders + customer directory | ✅ | `app/(dashboard)/customers`, `clients` |
| Wallet (SAR) + Tap top-up + token purchase | ✅ | `app/(dashboard)/wallet`, `lib/wallet.ts` |
| Subscriptions (plans + upgrade + invoices, wallet/Tap payment) | ✅ | `app/(dashboard)/subscription` |
| Services/add-ons marketplace + wallet purchase + adding storage | ✅ | `app/(dashboard)/services`, `lib/marketplace.ts` |
| Multi-tenant storage quotas + image compression (sharp) | ✅ | `lib/storage/quota.ts`, `image.ts` — `docs/STORAGE.md` |
| Super-admin panel (companies/plans/tokens/storage/marketplace/settings) | ✅ | `app/(admin)/admin` — `docs/ADMIN.md` |
| Sentry + `GET /api/health` + three environments (`APP_ENV`) | ✅ | `lib/env.ts`, `sentry.*.config.ts`, `app/api/health` — `docs/DEPLOYMENT.md` |
| **Multi-phase agent architecture** (Job Description constitution + per-department permissions matrix + Skills + orchestration) | ⬜ planned (up next) | `docs/AGENT_SYSTEM.md` |
| Automatic subscription renewal (Tap) · Public API v1 | ⬜ later | — |

**Operation:** the web app via `Dockerfile` (runs `prisma migrate deploy` automatically), and scheduling as a second service `npm run scheduler` (single instance).

---

## 11. Important links

- **Anthropic Docs:** https://docs.claude.com
- **Google Gemini API:** https://ai.google.dev/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Coolify Docs:** https://coolify.io/docs

---

**Last updated:** 8 July 2026
**Version:** 0.1.0 NX iWork
**Author:** Waleed + Claude Opus
