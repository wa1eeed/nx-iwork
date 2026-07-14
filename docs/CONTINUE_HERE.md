# ▶️ CONTINUE HERE — where we left off

> **Read this first when resuming.** It's the single source of "current state +
> what's next". Detailed history is in `CHANGELOG.md`; backlog in `docs/TODO.md`;
> architecture in `docs/AGENT_SYSTEM.md`, `docs/DATABASE.md`; admin in
> `docs/ADMIN.md`; infra/CDN/Cloud-Run in `docs/INFRA.md`; file storage in
> `docs/STORAGE.md`.

**Last updated:** 2026-07-14
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
21. **Multi-agent architecture — Phase 1 foundation.** `Agent.jobDescription`
    "constitution" (distinct from `persona`, injected into `buildSystemPrompt` and
    anchoring the two-layer contract) + a **per-department permission matrix** (the
    tool toggles grouped by functional area over the existing `getToolsForAgent` hard
    gate) + a **"justification test"** callout in the agent-creation form.
22. **Bookings adoption (from NXBook) — complete.** `lib/booking/engine.ts` —
    deterministic, timezone-aware slot generation + capacity-safe `createBooking`
    (the SYSTEM half of the two-layer contract). Schema: `ServiceAvailability` +
    `Service.durationMin/bufferMin/maxCapacity` + `Booking.serviceId`. `/bookings` is
    a **calendar** (month grid + per-day panel + confirm/mark-done/cancel + list
    toggle); `/bookings/availability` is the per-service **availability editor**; the
    **public booking flow** (`/api/public/[slug]/slots` + `/book` + `booking-button` →
    confirmation email) lets customers self-book bookable services; the agent
    `create_booking` tool is **routed through the engine**; and `/customers/[id]` shows
    booking/spend **KPIs**. Optional follow-ups: week/day calendar views, a `NO_SHOW`
    status (isolated enum migration), a dedicated confirmation page, a `BOOKING_CREATED`
    trigger event.

### Then this session (2026-07-09), shipped to `main` — design-handoff redesign **complete**
23. **Command Center global chrome (top bar).** Token-bank pill (`tokenBalance` +
    plan → `/wallet`), a **real Automation toggle** (`AutomationToggle`), and a
    **"N need you" bell** (pending-approval count → `/approvals`), wired through the
    dashboard layout.
24. **Guardrails (design View 4, `/settings` default tab) — real, not cosmetic.**
    New `Company` flags (`automationEnabled`, `requireApprovalForSensitive`,
    `requireMessageReview`, `spendApprovalCapEnabled`, `spendApprovalCapSar`);
    `updateGuardrails` action; design-exact toggles + dark token/wallet card. They
    **enforce**: the Automation switch **gates the scheduler** (`runDueSchedules`/
    `runDueTasks` skip paused tenants), and the flags are **injected into
    `buildSystemPrompt`** (approval-required / spend-cap / message-review govern
    `request_approval`, overriding the autonomy dial).
25. **Autonomy dial** — `AutonomyLevel` (`SUGGEST`/`ASK`/`AUTOPILOT`) end-to-end:
    schema + creation-form segmented control + prompt injection.
26. **Agent workspace (View 2)** — NEEDS-YOU pill (pending approval), a real **Pause
    agent** action (`setAgentPaused`; the scheduler skips PAUSED agents), the **WORK
    LOG** (flat, relative-time), the **3-layer memory** view (Working/Episodic/Semantic
    with real counts), and an internal-mode **chat entry** (`/chat?agent=<id>`).
27. **Approvals (View 3)** — dedicated `/approvals` inbox + polished `ApprovalCard`
    (avatar + decision + context + Approve/Send-back → `resolveApproval` wakes the agent).
28. **New-department modal (Modal B)** — 440px overlay, 34px hue swatches.
29. **Business-first navigation** — regrouped: Command Center · Workforce (agents +
    departments) · **Sales** · **Products & Services** · Billing · Configure. Adds
    `hasServices` gating; mobile nav inherits it.
30. **Sales financial section (`/sales`)** — revenue KPIs, orders-by-status pipeline,
    invoices (from `Invoice`), wallet/plan — all tenant-scoped real data.
31. **Demo seed + tests.** `scripts/seed-demo.ts` (`npm run seed:demo`) rebuilds a
    self-contained **"Zahra Home"** tenant (idempotent). Vitest suites for the
    guardrails/autonomy prompt logic + dept-accent hues (9 tests passing).
32. **"Run automation now."** Owner-triggered `runAutomationNow` (button on the
    Guardrails tab) fires the tenant's due schedules + pending autonomous tasks
    immediately (bounded to 5, respects `automationEnabled`) — `runDueSchedules`/
    `runDueTasks` gained an optional `companyId`. The fastest way to *see* agents act
    without waiting for the minute cron.
33. **Business modules (whole-business coverage).**
    - **360° counters** on `/overview` (`business-counters.tsx`) — customers, bookings,
      revenue, orders, workforce, inventory, each with a status breakdown.
    - **Discount coupons** — `Coupon` model + `/coupons` CRUD + `checkCoupon()` validator;
      `Order.couponId`/`discount`.
    - **Consumables inventory** — `InventoryItem` model + `/inventory` (CRUD + stock adjust
      + low-stock).
    - **Staff commissions** — `StaffMember` model + `/staff` CRUD; `Order`/`Booking`
      `staffMemberId`; `/commissions` computes attributed revenue + earned commission.
    - Nav: Workforce +Staff +Commissions · Sales +Coupons · Products & Services +Inventory.
    - Migration `20260709120000_coupons_inventory_staff` (additive).
    - **Wired to real activity:** staff attribution selectors on `/orders` +
      the bookings calendar (`setOrderStaff`/`setBookingStaff` → `/commissions`);
      the agent `create_order` tool redeems an optional `couponCode` (validate →
      discount → `usedCount++`). **Follow-up:** coupon redemption in the *public*
      storefront order flow (customer-entered code) + staff/coupon on manual create.
34. **Service-business platform (م1–م5), all shipped to `main`.**
    - **م1 booking-first:** departments = customer-facing **clinics** (`landingVisible`/
      `tagline`); `Service.departmentId` + `allowWaitlist`; a **tenant catalog-Service
      editor** at `/services` (marketplace → `/marketplace`); the **storefront is a real
      website** (`/[slug]`: nav/hero/clinics-as-sections/team/footer) + a per-service
      **detail page**; **waitlist** end-to-end (`BookingStatus.WAITLIST`).
    - **م2:** nav → **modules** (Command · CRM · Operations[orders-first] · AI workforce ·
      Team · Finance · Configure); **`/crm` hub** merges opportunities + customers + tasks
      (counter strip + shared tabs); `/customers` → `/crm`.
    - **م4 agent fixes:** current **date/time in business tz** injected into the prompt
      (accurate dates everywhere); customer prompt books via **check_availability →
      create_booking**; public agent auto-granted booking tools when `hasBookings`.
    - **م5:** top-bar **"View site"** shortcut; **coupon redemption in the public order
      flow**. Migrations `20260709140000_clinic_departments`, `20260709160000_booking_waitlist`.
    - **Follow-ups:** advanced pipeline board (IBP deal cards) · per-staff landing flag ·
      "website chatbot" badge + a public-conversations view · service images upload.

---

### Then this session (2026-07-14), shipped to `release/full-platform` — OpenClaw parity

Toward the owner's #1 goal: genuinely **replace/rival OpenClaw**, as the governed
admin layer. Full strategy + gap analysis in **`docs/OPENCLAW_PARITY.md`**.

30. **Provider-agnostic model registry.** `AiModel` table + super-admin
    **`/admin/models`** (add/enable/default/delete). **A new Gemini/OpenAI model is a
    data row, not a deploy.** `Agent.aiModelId` + an "AI model" dropdown per agent
    (null → capability tier). Migration `20260710180000`.
31. **OpenAI adapter + per-agent provider routing.** `lib/ai/providers/openai.ts`
    (Chat Completions + streaming + tools). A chosen model **pins its own vendor**
    (`platformProvider` / `providerForAgentModel` / `getProviderForModel`), so one
    agent can run GPT-4o while the company default stays managed Gemini. `AiProviderId`
    gains `openai`. Set `OPENAI_API_KEY` on the platform to enable.
32. **Business Objects** — owner-defined data types (`ObjectType` + `ObjectRecord`,
    JSON field schema → no migration to add a field). **`/data`**: schema builder +
    records table + dynamic form (8 field types). Agent tools `list_object_types` /
    `query_records` / `create_record` / `update_record` (gated on `hasObjects`,
    off the public widget). The sector-generality lever. Migration `20260714120000`.
33. **Agent Work** (`/agent-work`) — a **task-monitoring queue** (status filter,
    attempts, tokens, `depends_on` chain, Run-now) + a **scheduled-runs calendar**
    (month grid, business-tz, cron expanded via `expandOccurrences()`). Phase 4 ops
    command center.

---

## 🔜 Next up (resume here, in priority order)

1. **🎯 OpenClaw-parity reach + extensibility (the headline).** The governance +
   organization half is done and ahead of OpenClaw; Phase 4 ops command center
   (`/agent-work`), the **model registry**, and **Business Objects** all shipped
   (2026-07-14, above). **Remaining gap** (full analysis in `docs/OPENCLAW_PARITY.md`):
   - **Channels — Telegram + WhatsApp SHIPPED** (Settings → Channels). WhatsApp uses
     the **official Cloud API** (stateless → scales on Cloud Run + many tenants;
     chosen over unofficial QR bridges). **Embedded Signup** one-click onboarding
     is scaffolded (env-gated by `NEXT_PUBLIC_FACEBOOK_APP_ID` +
     `NEXT_PUBLIC_WHATSAPP_CONFIG_ID`; live use needs Meta Tech Provider approval;
     manual connect is the fallback). **Next:** a **Router** agent that picks the
     agent/department per inbound thread (today one agent/channel).
   - **MCP client + per-tenant server registry — SHIPPED** (`/integrations` +
     `lib/mcp/`). Register an MCP server; its tools reach agents namespaced
     `mcp__{key}__{tool}` through the same gate (a `use_mcp` grant), off the public
     widget. **Next below.**
   - **Skills as first-class** — named/versioned capability bundles. ← next.
   - **Agent Studio / test sandbox** — build/test surface showing tool calls + which
     model answered (today `/chat` is the owner↔agent console).
   Guiding law: the two-layer contract. See `docs/AGENT_SYSTEM.md`.
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
- **Autonomous agents run ONLY if the scheduler runs.** Two ways: (a) an external
  cron hits `POST /api/cron/run` with header `x-cron-secret: $CRON_SECRET` **every
  minute** (a Coolify Scheduled Task on the app service), or (b) the standalone
  `npm run scheduler` worker. **If `CRON_SECRET` is unset the endpoint is disabled
  (503)** → no autonomous runs at all. Per-tenant gating: the scheduler skips
  companies with `automationEnabled=false` and agents with `status=PAUSED`.
- **Guardrails are enforced, not decorative.** `Company.{requireApprovalForSensitive,
  requireMessageReview,spendApprovalCapEnabled,spendApprovalCapSar}` are injected into
  `buildSystemPrompt` and **override the autonomy dial**; `automationEnabled` gates the
  scheduler. Edit via the Guardrails tab (`/settings`) or the top-bar Automation toggle.
- **Demo data:** `DATABASE_URL=… npm run seed:demo` rebuilds the idempotent **"Zahra
  Home"** demo tenant (login printed on completion). Safe to re-run; it wipes only that
  demo company's data. Never point it at a real tenant.
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
Then read this file's "Next up", pick the top item, and continue.
