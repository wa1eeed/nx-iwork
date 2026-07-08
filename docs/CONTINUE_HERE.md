# ▶️ CONTINUE HERE — where we left off

> **Read this first when resuming.** It's the single source of "current state +
> what's next". Detailed history is in `CHANGELOG.md`; backlog in `docs/TODO.md`;
> architecture in `docs/AGENT_SYSTEM.md`, `docs/DATABASE.md`; admin in
> `docs/ADMIN.md`; infra/CDN/Cloud-Run in `docs/INFRA.md`; file storage in
> `docs/STORAGE.md`.

**Last updated:** 2026-07-08
**Live:** https://bznss.one/ · repo `github.com/wa1eeed/nx-iwork`
**Deploy:** `git push origin HEAD:main` → Coolify builds & runs
`prisma migrate deploy && node server.js`. **`main` is the deploy branch**, not
`release/full-platform` (the local working branch, which is ahead of `origin/main`).

---

## ✅ Snapshot — what's live

Core platform (provider-agnostic AI → managed **Vertex** with keyless ADC + token
bank · agents/departments/persona · task engine · scheduler + event triggers ·
semantic memory · modular architecture · CRM · catalog · FAQ · R2 storage · public
landing page + agent widget + order flow) — **plus** the 2026-06-20 arc below.

### This arc (2026-06-20), all shipped to `main`
1. **Reference codes** — `CUS-001`/`AGT-001`/… per-tenant via `RefCounter` (`lib/refs.ts`).
2. **English-primary redesign** — default locale `en`; sectioned sidebar; rebuilt
   **onboarding** (language → data → plan → username w/ live check); **settings**
   (Storefront, Custom domain, Alerts); overview setup checklist; i18n for overview
   + full CRM + all section-page headers.
3. **HR Agent lifecycle system** — single hiring gateway
   `hrAgent.onboardAndDeployAgent` (`lib/agent/hr-agent.ts`): 9 templates · hybrid
   create (`/agents/new`) · conflict-check (gemini-2.5-flash) · cognitive onboarding
   (vector memory) · `ONBOARDING→ONLINE` · org chart · `POST /api/hr/deploy` ·
   advisory mode · If-Then scenario builder · profile tabs (KPIs/Memory).
4. **Complaint escalation** — sentiment detection on public chat → `COMPLAINT_RECEIVED`
   + Telegram alert (`lib/agent/sentiment.ts`, `lib/notify/telegram.ts`).
5. **Per-agent token cap by plan** — `lib/billing/agent-tokens.ts`, `AGENT_TOKEN_CAP`.
6. **RLS** — enabled+forced with a permissive-when-unset policy (see gotchas).

### Then this arc (2026-06-21), all shipped to `main`
7. **Aurora design system + marketing landing** — brand gradient, glass chrome,
   spring motion, **responsive mobile nav**, confetti; **light theme default**;
   pro conversion landing at `/` (coded mockups, pricing, FAQ, **SEO** JSON-LD,
   **auth-aware nav**). See `CHANGELOG.md`.
8. **Super Admin console (core)** — `app/(admin)/admin`, `SUPER_ADMIN`-guarded.
   See **`docs/ADMIN.md`**. Become admin: `scripts/make-admin.ts <email>`.
9. **Production hardening** — AI rate-limiter (429 backoff+jitter), **per-agent
   tool permissions** (`Agent.permissions` + `getToolsForAgent`), HNSW vectors.
10. **Token-bank fix** — default 5,000,000 (was 100k); diagnostic log per chat.
11. **Streaming dashboard chat (SSE)** + **internal vs customer conversation
    modes** (agent knows it's talking to the owner in the dashboard).
12. **Decision:** next infra home = **Google Cloud Run** (`docs/INFRA.md`).

### Then the customer-facing arc (2026-06-22), all shipped to `main`
13. **Mobile-first dashboard** — swipeable section carousel + bottom tab bar
    (`mobile-section-carousel.tsx`, `mobile-tabbar.tsx`).
14. **Wallet** (SAR) + **Tap top-up** + **buy token credits**; **Subscription**
    page (current plan, upgrade, invoices; pay from wallet or Tap card/Apple Pay);
    **Services marketplace** (admin CRUD + buy with wallet) — incl. a **"buy extra
    storage" add-on**. `lib/{wallet,marketplace,billing/subscription}.ts`.
15. **CRM revamp → Opportunities** — pipeline (Kanban + list), 360° detail with
    activity (notes/visits/reminders/meetings) + convert-to-order; orders auto-set
    the opportunity WON (cancel reverts). New **Customers directory** (`/clients`).
16. **Storage** — central `File` registry + **multi-tenant quota** (per-plan
    ceilings + per-tenant override + 403 on over-quota + `/admin/plans` telemetry)
    + **server-side image compression** (sharp → WebP). See `docs/STORAGE.md`.
17. **Latin digits everywhere** + no thousands-separator in prices (`lib/format.ts`).
18. **Admin from env** (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) + docs restructure
    (`docs/README.md` index, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`).

### Then this session (2026-07-08), committed on `release/full-platform`
19. **Env-aware three environments** — `APP_ENV` (development/staging/production) in
    `lib/env.ts`; `NODE_ENV` can't separate staging from prod. Boot guardrails warn on
    test/live payment-key mismatch + missing critical integrations. **Sentry**
    (server/edge/client, no-op without a DSN, tagged by `APP_ENV`) + **`GET /api/health`**
    (public DB probe, no secrets).
20. **Professional per-tenant email (Resend)** — central account sending from the
    platform domain + per-tenant sender (`BusinessSettings.emailSenderName`/
    `emailReplyTo`/`marketingEmailsEnabled`; Settings → Email tab).
    `lib/notifications/tenant-email.ts` (`sendPlatformEmail` / `sendTenantEmail`, marketing
    gated + List-Unsubscribe). Wired: **welcome on signup** + **order confirmation**
    (tenant sender, localized to the storefront language); public order form captures email.

---

## 🔜 Next up (resume here, in priority order)

1. **🎯 Multi-agent architecture — Phase 1 (the headline).** Job Description
   "constitution" (`Agent.jobDescription`, distinct from `persona`) + a granular
   **per-department permission matrix** over the existing `getToolsForAgent` hard gate +
   a **"justification test"** in the agent-creation UX (deterministic responsibility →
   workflow; judgment responsibility → agent). Then Phase 2 **Skills**, Phase 3
   **orchestration** (internal event bus + `delegate_to_agent`/`request_from_agent`/
   `depends_on`), Phase 4 **ops command center**. Guiding law: the two-layer contract
   (system = deterministic transactions; agents = the human/judgment work). See
   `docs/AGENT_SYSTEM.md`.
2. **Tap subscription auto-renewal** — recurring charge + webhook idempotency +
   dunning/retry on failure + receipt email.
3. **Deep-component i18n (English-primary)** — the remaining translation long-tail
   (`order-manager`, `product-form`, `faq/trigger/task/department/modules` managers, the
   dashboard chat, agent create/edit deep fields, the public landing page).
4. **Fully enforce RLS** — adopt `withTenant()` (`lib/db-tenant.ts`) across tenant
   queries, then drop the permissive `IS NULL` fallback. Today only the HR hire flow pins
   the tenant. See gotchas.
5. **Email pro tier** — verified custom sending domain (Resend Domains API) + billing
   receipts + per-recipient marketing suppression.
6. **Then the backlog** (`docs/TODO.md`): `CART_ABANDONED` source · Admin Phase 2 ·
   storage follow-ups (private files, presigned-POST size cap, orphan cleanup) · Public
   API v1 · **Google Cloud Run migration** (`docs/INFRA.md`).

---

## ⚠️ Invariants & gotchas (don't relearn these the hard way)

- **Deploy = push to `origin/main`** (Coolify). Keep migrations **additive**.
- **English is primary**, Arabic secondary. New UI uses `next-intl` (`messages/en.json`
  + `ar.json`); don't hardcode strings.
- **All agent creation MUST go through the HR gateway** (`hrAgent.onboardAndDeployAgent`
  / `createAgent` / `createAgentFromTemplate`). Never `db.agent.create` directly —
  you'd skip conflict-check, onboarding, scenarios, permissions, and the token cap.
- **Conversation modes** (`buildSystemPrompt` `audience`): dashboard chat + tasks =
  **`internal`** (agent talks to the OWNER as their employee); public widget =
  **`customer`**. Don't make the dashboard treat the owner as a customer.
- **Hybrid principle:** customer-facing transactions (public order) are deterministic
  **pure code** (`/api/public/[slug]/order` → `Order`). Agents are the augmentation
  layer — they act via **function-calling tools** gated by `Agent.permissions`
  (`getToolsForAgent`: module ∩ permissions; empty = all). Never mutate from raw
  model text.
- **Token bank:** charge the real `usageMetadata.totalTokenCount` (incl. thinking);
  default grant is **5,000,000** (`Company.tokenBalance`). No custom token math.
- **Light theme is the default**; dark via the toggle.
- **Admin:** `/admin` is `SUPER_ADMIN`-only (`lib/admin.ts`); promote via
  `scripts/make-admin.ts`. See `docs/ADMIN.md`.
- **RLS is permissive-until-adopted.** It only isolates inside a `withTenant`-pinned
  tx. Un-pinned queries rely on app-level `companyId` (which is everywhere). Don't
  assume the DB isolates un-pinned queries — it doesn't yet.
- **Gemini SDK = `@google-cloud/vertexai`** (managed Vertex + ADC), NOT `@google/genai`.
  Embeddings = `gemini-embedding-001` (1536 dims). Models: `gemini-2.5-flash`/`-pro`.
- **AI auth** is keyless ADC via `GOOGLE_APPLICATION_CREDENTIALS_JSON` env (see
  `docs/AI_VERTEX.md`). Don't reintroduce inline `GCP_CLIENT_EMAIL`/`GCP_PRIVATE_KEY`.
- **Verify before commit:** `npm run type-check && npm run build`. Commit messages end
  with the `Co-Authored-By: Claude …` trailer.

---

## 🔁 How to resume in one minute

```bash
git checkout release/full-platform && git pull          # local working branch
git log --oneline origin/main..HEAD                      # what's unpushed (if any)
npm install && npm run type-check                        # sanity
```
Then read this file's "Next up", pick item 1 (deep-component i18n), and continue.
