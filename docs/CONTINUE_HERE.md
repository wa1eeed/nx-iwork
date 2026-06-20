# ▶️ CONTINUE HERE — where we left off

> **Read this first when resuming.** It's the single source of "current state +
> what's next". Detailed history is in `CHANGELOG.md`; backlog in `docs/TODO.md`;
> architecture in `docs/AGENT_SYSTEM.md` and `docs/DATABASE.md`.

**Last updated:** 2026-06-20
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

---

## 🔜 Next up (resume here, in priority order)

1. **Deep-component i18n (English-primary)** — the remaining translation long-tail:
   `order-manager`, `product-form`, `faq-manager`, `trigger-manager`, `task-manager`,
   `department-manager`, `modules-manager`, the **dashboard chat**, the **agent
   create/edit deep fields**, and the **public landing page** (`app/(public)/[slug]`).
   Pattern is established: extract Arabic → `messages/{en,ar}.json` namespaces →
   `useTranslations`/`getTranslations`. (Tracked task; this is the only redesign item left.)
2. **Fully enforce RLS** — adopt `withTenant()` (`lib/db-tenant.ts`) across tenant
   queries, then tighten the policy (drop the permissive `IS NULL` fallback). Today
   only the HR hire flow pins the tenant. See gotchas.
3. **`CART_ABANDONED` source** — the event + scenarios exist, but nothing dispatches
   it yet (no cart/checkout-intent model). Add a cart/checkout-intent capture (or an
   external integration) that calls `dispatchEvent(companyId, 'CART_ABANDONED', …)`.
4. **Then the standing backlog** (`docs/TODO.md`): Super Admin SaaS console · Tap
   payments (token top-ups + subscriptions) · Sentry · Public API v1 · bookings
   calendar · least-privilege Vertex role (replace prod `Owner` grant).

---

## ⚠️ Invariants & gotchas (don't relearn these the hard way)

- **Deploy = push to `origin/main`** (Coolify). Keep migrations **additive**.
- **English is primary**, Arabic secondary. New UI uses `next-intl` (`messages/en.json`
  + `ar.json`); don't hardcode strings.
- **All agent creation MUST go through the HR gateway** (`hrAgent.onboardAndDeployAgent`
  / `createAgent` / `createAgentFromTemplate`). Never `db.agent.create` directly —
  you'd skip conflict-check, onboarding, scenarios, and the token cap.
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
