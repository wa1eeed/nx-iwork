# Handoff: NX iWork — Command Center & AI Workforce Dashboard

## Overview
The **Business Owner dashboard** for **NX iWork** (live on bznss.one) — the SaaS where a business owner builds a company of **AI employees** organized into **departments**, hired through an **HR-agent gateway**, each with a job description, persona, 3-layer memory, tools, and wake-triggers. The owner **supervises** an automated company: agents work on their own from triggers, and pause for approval on sensitive decisions.

This design covers the owner-facing `(dashboard)` surfaces: **Command Center** (workforce overview), **Agent workspace**, **Approvals**, **Guardrails**, plus the **Hire (HR gateway)** and **New department** modals.

## About the Design Files
`Northwind — AI Company.dc.html` is a **design reference created in HTML** — a working prototype of look, layout, copy, and interactions. **It is not production code to copy directly**, and it uses a small custom prototyping runtime (`<x-dc>`, `renderVals()`) that you should **ignore**.

Your task: **recreate this UI inside the existing NX iWork codebase** using its real stack and patterns — **Next.js 16 App Router, TypeScript (strict), Tailwind CSS + shadcn/ui, next-intl (ar/en, RTL), framer-motion, lucide-react** — and wire it to the real data layer (Prisma/PostgreSQL) and agent runtime (`lib/agent/*`, `lib/ai/*`, `lib/billing/*`) instead of the prototype's in-memory mock state. Match the layout and visual spec below; adapt tokens to the app's existing design system where one already exists.

## Fidelity
**High-fidelity (hifi).** Colors, spacing, and interactions are intentional — recreate closely. **Two deliberate substitutions when you rebuild:**
1. **Fonts:** the prototype uses *Bricolage Grotesque* (display) + *Instrument Sans* (body). The project standard is **Inter (en) + Tajawal (ar)** — use those instead. Keep the type *scale/weights* below; only the family changes.
2. **Icons:** the prototype uses emoji/Unicode glyphs as placeholders. Replace **all** with **lucide-react** (see mapping under Assets).

Everything else (layout, warm palette, department-accent system, card anatomy, motion) should be reproduced faithfully.

---

## Design Tokens

### Typography
- **Display / headings:** Inter (project standard; prototype shows Bricolage Grotesque) — weights 600–800. Used for wordmark, screen titles, agent names, big stat numbers.
- **Body / UI:** Inter (en) / Tajawal (ar) — weights 400/500/600.
- Scale: screen titles 22–24px/700 · card titles 14–14.5px/700 · body 12.5–13.5px · labels 11px/600 uppercase letter-spacing .06–.09em · meta 11–12px · big stat numbers 18–26px/700.
- **RTL:** the app is bilingual (next-intl). Build layouts direction-agnostic (logical properties / `ms-`/`me-` etc.); the prototype is LTR (English-first) but must mirror cleanly in Arabic. Numerals stay **Latin**.

### Color — warm neutral base
| Token | Value | Use |
|---|---|---|
| Canvas bg | `#efe9dd` | app backdrop |
| Surface | `#f6f2ea` | main content, modals |
| Card / raised | `#fffdf9` | cards, sidebars, top bar |
| Inset / track | `#efe9dd` / `#f0ebe0` | progress tracks, chips, hovers |
| Ink | `#211d17` | primary text, dark buttons/cards, "You" avatar |
| Ink-2 | `#3f382d` / `#4d463b` | secondary text |
| Muted | `#8a8073` / `#9a9082` | labels, meta |
| Faint | `#a89d8c` / `#b3a894` | timestamps, placeholders |
| Border | `#e8e1d3` · `#e0d7c7` · `#eee4d2` | cards · inputs · dividers |
| Dashed | `#d8cfbd` | empty/add states |
| Alert | `#c2593a` | approval badges, "N need you" |
| Success green | `oklch(0.62 0.13 155)` | approve buttons, ONLINE dot, automation-on |

### Department accent system — vibrant multi-accent, one hue per department (harmonious via shared oklch chroma/lightness)
Per hue **H**: accent `oklch(0.64 0.13 H)` · ink `oklch(0.44 0.12 H)` · tint `oklch(0.95 0.04 H)`.

| Department | H |
|---|---|
| Sales | 155 (green) |
| Marketing | 40 (coral) |
| Support | 305 (purple) |
| Operations | 200 (teal-blue) |
| Finance | 80 (amber) |
| Appointments | 250 (blue) |
| custom dept palette | 250, 40, 155, 305, 80, 200, 340, 20 |

**Model-tier accents** (small chips): Fast → hue 155, Balanced → 80, Advanced → 305 (same oklch formula).

**Status colors** (agent dot / pill): ONLINE `oklch(0.6 0.14 155)` green · NEEDS-YOU = dept accent (amber-ish) · ONBOARDING `oklch(0.7 0.13 80)` amber (pulsing) · IDLE/PAUSED `#c9c0af` grey.

### Radius / shadow / spacing / motion
- Radius: cards 14px · panels/modals 18px · buttons 8–11px · inputs 9–10px · chips 6px / pills 999px · avatars 50%.
- Shadow: modal `0 30px 80px -20px rgba(0,0,0,.5)` · small raised `0 1px 2px rgba(0,0,0,.06)`.
- Spacing: 8px rhythm; card padding 13–16px, screen padding 20–30px, gaps 5/7/9/13/16/22px.
- Motion (framer-motion): `fadein` .25–.3s (new cards/rows), `pop` .2s scale .97→1 (modals), `pulse` 2s on live status dots, `.2s` toggles/progress transitions.

---

## Screens / Views

Fixed **top bar + left nav + main region**. Main swaps between 4 views; 2 modals overlay.

### Global chrome
**Top bar (64px, `#fffdf9`, bottom border):**
- Left: ◆ mark + wordmark (the **tenant business name**, e.g. "Zahra Home") + subtitle "Powered by NX iWork".
- Right: **token-bank pill** (dot + `4.7M tokens` + `Growth` plan — reads `Company.tokenBalance` + plan); **Automation toggle pill** (animated dot + "Automation on/Paused" + switch — reflects the scheduler/triggers being active); **"N need you" bell** (alert color when N>0 → navigates to Approvals); **"You" avatar** (owner).

**Left nav (240px):**
- Items: **Command Center**, **Approvals** (+ red count badge), **Guardrails**. (In the real app these map to `/overview`, an approvals inbox, and `/settings`; you likely also have `/agents`, `/departments`, `/tasks`, `/chat`, `/customers`, `/products`, `/wallet`, `/subscription` — extend the nav to the app's real routes.)
- "DEPARTMENTS" list: colored dot + name + agent count (from `Department` + agent counts). Clicking a dept opens hire prefilled to that dept in the prototype; in-app it should route to the department page.
- "＋ New department" (dashed) → New Department modal.
- Bottom **dark "TODAY'S OUTPUT" card:** big task-count + progress + "N agents · M online now".

### View 1 — Command Center (`/overview`)
Two columns: center roster (scrolls) + right rail (322px).
- **Header:** "Your workforce" + live label ("Live · agents acting on triggers" / paused) + dark **"＋ Hire AI employee"** button.
- **Roster grouped by department:** each group = header (dept dot + name + "· led by <lead>" + faint "＋ add") then a **2-col grid of agent cards**; empty depts show a dashed "Hire your first <Dept> agent" tile.
- **Right rail:** "Needs your attention" + red count + a one-line note that agents route decisions via `request_approval`; stack of **approval cards**; empty → "🌿 All caught up"; then "Live activity · timeline" feed (relative time + text) — maps to `TimelineEvent`.

**Agent card** (key repeating component; clickable → workspace):
- White `#fffdf9` / border `#e8e1d3` / radius 14 / padding 14 / flex row gap 13 / `cursor:pointer`. IDLE → opacity .86. **NEEDS-YOU** → bg dept **tint**, 1.5px dept-**accent** border.
- Avatar 46px (dept tint bg, 2px accent ring, ink initials, 15px/700) + status dot 13px (2.5px cream ring), ONBOARDING dot pulses.
- Right: name 14/700 + role 11.5 muted; current **task** line 12.5; then one of: **progress bar** (ONLINE; 5px, track `#efe9dd`, fill accent), **Approve + Send back** buttons (NEEDS-YOU), or two chips — **trigger chip** ("⚡ <trigger>", dept tint/ink) + **model-tier chip** (neutral `#f0ebe0` with a hue dot + Fast/Balanced/Advanced).

**Approval card** (rail): white/border/radius 13; 28px dept avatar + title 12.5/600 + sub 11 muted; optional **preview** quote block (`#faf6ee`); primary green + secondary outline buttons (labels vary: "Approve & send"/"Approve" + "Send back"/"Decline"/"Hold").

### View 2 — Agent Workspace (`/agents/[id]`)
- Top 8px dept-accent banner; "← Back". Header: 72px avatar + status dot; name (26/700) + **status pill** (ONLINE / NEEDS YOU / ONBOARDING / IDLE); "Role · Department · reports to <manager>"; **model-tier pill** ("Balanced model"); "Pause agent" button. Then **persona** callout (dept tint bg + accent border).
- **Tab bar:** Activity · Scenarios · KPIs · Memory · Settings (active = ink text + 2px ink underline).
- **Grid `1fr 300px`.** Right column = always-on facts: card 1 (Status pill, Model tier, Reports to, Department); card 2 ("Tokens this month" used/cap + bar + note "Per-agent cap protects the shared token bank" — reads `Agent.tokenLimit` + `lib/billing/agent-tokens.ts`).
- **Tab contents (left):**
  - **Activity:** "Work log" card (status-dot + text + relative time rows; entries reflect trigger fired, tool calls, memory recall) + "Direct <name> · internal mode" **chat** card (right-aligned dark = you, left-aligned dept-tint = agent; input + Send; Enter submits). This is `internal` audience mode (`buildSystemPrompt`) — the agent acts as the owner's employee, not customer service.
  - **Scenarios:** if-then cards ("When <trigger> → <action>") each tagged with wake-trigger **kind** (Schedule / Event / Inter-agent) — maps to `EventTrigger`s from `ifThenScenarios`. "＋ Add scenario".
  - **KPIs:** 3-up metric cards (label + big value + trend) from `Agent.defaultKpis`/live stats, plus a "Tasks completed" row (`tasksCompleted`).
  - **Memory:** three cards — **Working** (last N messages, ~5K tokens), **Episodic** (N tasks/convos in Postgres), **Semantic** (N long-term memories as 1536-dim vectors via pgvector; nightly consolidation) — maps to `AgentMemory` + `lib/agent/memory.ts`.
  - **Settings:** Job Description (governs — `Agent.jobDescription`), **Tool permissions** allow-list chips (`Agent.permissions` / `getToolsForAgent`), **Autonomy** segmented (Suggest/Ask/Autopilot) + description.

### View 3 — Approvals
Centered (max 640). Title + subtitle ("Sensitive decisions your agents paused for. Approving wakes them to continue."). Larger approval cards (40px avatar, title 14.5/700, optional preview, primary/secondary). Empty → "🌿 Nothing needs you right now." Maps to `Approval` records / `request_approval` tool + `PENDING_APPROVAL` task state.

### View 4 — Guardrails (`/settings`)
Centered (max 620).
- **Dark token/wallet card:** "MANAGED TOKEN BANK" (`4.7M of 5.0M · Growth plan` + bar) | "WALLET" (`1,250 SAR` + "Buy tokens"). Maps to `Company.tokenBalance`, plan, wallet (Tap top-up).
- Rule rows: **Sensitive decisions need approval** (toggle) · **Customer-facing messages need review** (toggle) · **Spend approval cap** (`500 SAR` + toggle) · **Per-agent monthly token cap** (`600K`, info) · dark **Scheduler & triggers** master toggle (cron + event triggers on/off).
- **Toggle spec:** 42×24 track, green on / `#d8cfbd` off, 18px white knob `left 3→21px`, .2s.

### Modal A — Hire an AI Employee (HR gateway — `/agents/new` / `POST /api/hr/deploy`)
Overlay `rgba(33,29,23,.42)`; 660px panel, radius 18, `pop`, click-outside closes. 7px banner (grey step 0 → dept accent step 1). **Never bypass `hrAgent.onboardAndDeployAgent`** — this modal drives that 7-step pipeline.
- **Step 0 — template vs custom:** 2-col grid of the **9 system templates** (`AgentTemplate`): Sales, Support, Marketing, Operations, Finance, Appointments, Lead Qualifier (SDR), Social Media, Account Manager — each card = icon (template `icon`/`accent`) + role + "Department · Model". Plus a dashed **"Build a custom agent from scratch"**.
- **Step 1 — configure:** header "Set up your <Role>" with back/✕. **HR advisory banner** (green "no overlapping role found — clear to onboard" OR amber "‹Name› already covers ‹Role› in ‹Dept› (86% overlap) — consider editing them instead" — from `lib/agent/conflict-check.ts`, `gemini-2.5-flash`). Fields: **Name**; **Reports to** (chips: "You (owner)" + manager agents → `parentId`/`direct_manager_id`); **Department** (accent chips); **Model tier** (Fast/Balanced/Advanced → `lib/ai/models.ts`); **Job description** (textarea, prefilled from template `coreInstructions`, governs the agent); **Tool permissions** (allow-list toggle chips over the tool catalog → `defaultPermissions`/`permissions`); **If-then scenarios → wake triggers** (from template `ifThenScenarios`); **Autonomy** segmented. Footer: dark **"Onboard & hire <name>"** + Cancel.
- **On hire:** create the agent with status **ONBOARDING** (cognitive onboarding seeds `AgentMemory` from business context + FAQ), navigate to its workspace, then flip **→ ONLINE** and log a timeline entry. Sets `tokenLimit` from plan.

### Modal B — New Department (`/departments`)
440px. Name input + **color** hue swatches (34px circles, selected = ink ring). "Create department" (dimmed until named). Appends a `Department`; shows empty "hire your first" state.

---

## Interactions & Behavior
- **Nav / bell** switch views; agent cards open the workspace; "Back" returns. Modals via overlay/✕.
- **Automation toggle** reflects the scheduler + event triggers being live (`lib/agent/scheduler.ts`, `/api/cron/run`); off = triggers paused. Prototype also drives a fake "live" sim — in-app this is real trigger activity.
- **Approve / Send back** clears the item, wakes the linked agent (approve → starts result task; send back → agent revises), updates badges + timeline. Backed by `request_approval` + `PENDING_APPROVAL`.
- **Hire** runs the HR pipeline (conflict check → onboarding → ONLINE).
- **Chat** = internal-mode directive to the agent; it acts via tools and reports back (streamed token-by-token over SSE in the real app).
- **Autonomy** control sets how much the agent may do without approval.
- **Empty states:** empty dept, empty approvals, empty chat.

## State Management (map to real models — see docs/PROJECT.md, AGENT_SYSTEM.md, DATABASE.md)
Replace the prototype's in-memory state with Prisma models + server actions + the agent runtime.
- **Company:** `tokenBalance`, plan, wallet (SAR), guardrail flags (approval rules, spend cap, per-agent cap), timezone, branding, language.
- **Department:** `{ name, accent/hue, leadAgentId }`.
- **Agent:** `{ id, name, initials/avatar, role, departmentId, status: ONLINE|ONBOARDING|PAUSED|IDLE|PENDING_APPROVAL, jobDescription (governs), persona, model tier, autonomy, parentId/direct_manager_id, permissions[] (tool allow-list), ifThenScenarios→EventTrigger[], defaultKpis/liveStats, tasksCompleted, tokenLimit + monthly usage, isCustom, templateId }`.
- **AgentMemory:** 3 layers (working = recent ChatMessages; episodic = Tasks/ChatMessages; semantic = pgvector embeddings, `gemini-embedding-001` @1536).
- **AgentTemplate:** the 9 blueprints (`personalityProfile, coreInstructions, ifThenScenarios, defaultKpis, defaultPermissions, model, icon, accent`).
- **Task / Approval / TimelineEvent:** task lifecycle, `request_approval` items, activity feed.
- **Triggers:** the 5 types — User Message, Task Assignment, Schedule, Webhook, Inter-Agent.
- **AI/billing:** `lib/ai/` (Vertex/Gemini default, BYOK optional), `lib/billing/tokens.ts` (bank), `lib/billing/agent-tokens.ts` (per-agent cap).
- **Multi-tenancy:** every query scoped by `companyId` (+ RLS `app.current_tenant_id`).

## Assets
- **Fonts:** use the project's **Inter + Tajawal** (not the prototype's Bricolage/Instrument Sans).
- **Icons → lucide-react** (replace emoji placeholders):
  - ◆ wordmark → your logo mark · ▦ Command Center → `LayoutGrid` · ✔ Approvals → `CheckCircle` · ⚙ Guardrails → `Shield`/`SlidersHorizontal` · 🔔 → `Bell` · ⚡ trigger → `Zap` · 🌿 empty → `Sprout`/`Leaf` · token dot → `Coins` · 🧠 working memory → `Brain` · 🗂️ episodic → `Archive`/`Database` · 🔮 semantic → `Sparkles`/`Network`.
  - Template icons (Sales 💼 → `Briefcase`, Support 💬 → `MessageCircle`, Marketing 📣 → `Megaphone`, Operations 🗂️ → `Boxes`, Finance 📊 → `BarChart3`, Appointments 📅 → `CalendarDays`, SDR 📈 → `TrendingUp`, Social 📱 → `Smartphone`, Account Manager 🤝 → `Handshake`).
- **Avatars:** monogram (initials) circles — no image assets; add real generated persona avatars later if desired.
- No raster images or hand-drawn SVGs.

## Files
- `Northwind — AI Company.dc.html` — the complete interactive prototype (Command Center, Agent workspace with 5 tabs, Approvals, Guardrails, HR hire modal, New department modal, live sim). Open in a browser to click every flow; read its `renderVals()` for exact derived styling and handler behavior. (Filename is legacy — the content is the NX iWork "Zahra Home" tenant.)
