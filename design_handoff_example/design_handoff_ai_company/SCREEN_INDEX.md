# Screen index — which reference to use for each screen

When building a screen, read the matching **screenshot** and the linked **README section**.
Screenshots are exact renders of the prototype; the README section has the measurements,
colors, copy, and data-model mapping for that screen.

| # | Screenshot | Screen | Route (real app) | README section | Notes |
|---|-----------|--------|------------------|----------------|-------|
| 01 | `screenshots/01-screen.png` | **Command Center** — workforce overview | `/overview` | "View 1 — Command Center" + "Agent card" | Roster grouped by department; right rail = approvals + live timeline. Build **AgentCard** and **ApprovalCard** here first. |
| 02 | `screenshots/02-screen.png` | **Agent workspace — Activity tab** | `/agents/[id]` | "View 2 — Agent Workspace" | Header (avatar + status pill + model pill), persona callout, tab bar, Work log + internal-mode chat, right facts rail (status/model/reports-to/tokens). |
| 03 | `screenshots/03-screen.png` | **Agent workspace — Memory tab** | `/agents/[id]` | "View 2 → Memory" | 3-layer memory cards (Working / Episodic / Semantic pgvector). Same page also has Scenarios · KPIs · Settings tabs — see README. |
| 04 | `screenshots/04-screen.png` | **Approvals** | approvals inbox | "View 3 — Approvals" | Sensitive-decision queue; approve wakes the agent. Backed by `request_approval` + `PENDING_APPROVAL`. |
| 05 | `screenshots/05-screen.png` | **Guardrails** | `/settings` | "View 4 — Guardrails" | Dark token-bank + wallet card, rule toggles (approval, review, spend cap SAR, per-agent token cap), scheduler master toggle. |
| 06 | `screenshots/06-screen.png` | **Hire modal — Step 0 (templates)** | `/agents/new` | "Modal A — Hire (HR gateway)" | Grid of the 9 system templates + "Build custom". |
| 07 | `screenshots/07-screen.png` | **Hire modal — Step 1 (configure)** | `/agents/new` | "Modal A — Hire (HR gateway)" | Name, reports-to, department, model tier, job description, tool permissions, if-then scenarios, autonomy — with the live **HR conflict advisory** banner. MUST call `hrAgent.onboardAndDeployAgent`. |
| — | (see standalone HTML) | **New department modal** | `/departments` | "Modal B — New Department" | Name + color hue swatches. Open `NX-iWork-design-standalone.html` and click "＋ New department" to see it live. |

## How to see interactions not captured in a still
Open `NX-iWork-design-standalone.html` in a browser (works offline). Everything is clickable:
hire an agent (watch ONBOARDING → ONLINE), approve/decline (queue clears, agent wakes),
switch agent tabs, toggle automation, open the New Department modal.

## Build order (one screen at a time)
Command Center (01) → Agent workspace tabs (02, 03) → Approvals (04) → Hire HR gateway (06, 07)
→ Guardrails (05) → New Department. Commit after each.
