# 🥊 OpenClaw parity — direction, what's shipped, and the gap

> **The strategic brief.** The owner's stated #1 priority: bznss.one must genuinely
> **replace / rival OpenClaw** — every capability people reach OpenClaw for should
> exist here for real — but wrapped in the admin, governance, and UX layer that is
> our moat. This doc is the source of truth for that direction: the positioning,
> what already ships, and the ordered gap. Pair with [`ROADMAP.md`](./ROADMAP.md)
> (plan) and [`AGENT_SYSTEM.md`](./AGENT_SYSTEM.md) (agent internals).

## 1. Positioning — what we are, and what OpenClaw is

OpenClaw is a powerful but **raw** agent runtime: you wire MCP servers, channels
(WhatsApp/Telegram), and skills yourself. It's a toolbox for builders.

bznss.one is the **managed, governed product** on top of that idea: a business
owner hires a **team of AI employees organized by department**, each with a role
(archetype → structured persona → mandate), hard permission scoping, autonomy
tiers, approvals, token metering, memory, delegation, and a calendar. The owner
never touches a config file.

**The rule (adopted):** keep the department-as-team-of-AI-employees model as the
*product*. Add OpenClaw-class capabilities as *layers underneath* it. **Never**
fork OpenClaw or make it the core — the governance/UX layer is the moat, and a
raw runtime underneath is a commodity.

So the target is: *OpenClaw's power, minus the assembly required.*

## 2. Capability map — us vs OpenClaw

| Capability | OpenClaw | bznss.one | Status |
|---|---|---|---|
| Agent loop + tool/function calling | ✅ | ✅ `lib/agent/core.ts` | **shipped** |
| Multi-tenant isolation | partial | ✅ every query `companyId`-scoped | **shipped, stronger** |
| Per-agent tool permissions (hard gate) | manual | ✅ `getToolsForAgent` allow-list | **shipped, stronger** |
| Human-in-the-loop approvals | DIY | ✅ `request_approval` + Guardrails | **shipped, stronger** |
| Memory (separation of concerns) | ✅ | ✅ 3-layer, pgvector, per-agent | **shipped** |
| Agent-to-agent delegation | ✅ | ✅ `delegate_to_agent` + `depends_on` | **shipped** |
| Autonomy tiers | DIY | ✅ ASK / ACT / autonomy | **shipped** |
| Token metering / cost control | DIY | ✅ token bank + per-agent cap | **shipped, stronger** |
| **Provider-agnostic model switching** | ✅ | ✅ **model registry** (§3) | **shipped** |
| **Owner-defined dynamic data** | via MCP/DB | ✅ **Business Objects** (§4) | **shipped** |
| **Scheduled-task calendar + task monitor** | ✗ (raw) | ✅ **Agent Work** (§5) | **shipped, ahead** |
| Channels — Telegram inbound | ✅ | ✅ `/api/channels/telegram` + Settings → Channels | **shipped** |
| Channels — WhatsApp inbound | ✅ | ⏳ (`ChannelType.WHATSAPP` reserved) | **gap — next** |
| MCP client + per-tenant server registry | ✅ (core) | ⏳ | **gap** |
| Skills as first-class composable units | ✅ | partial (tools) | **gap** |
| Agent Studio / test sandbox | DIY | partial (`/chat`) | **gap (nice-to-have)** |

Net: the **governance + organization** half is done and is ahead of OpenClaw.
The remaining gap is **reach** (channels), **extensibility** (MCP/Skills), and a
polished **build/test surface** (Studio).

## 3. Model registry — provider-agnostic, per-agent (SHIPPED)

Goal the owner set: *add any new Gemini/OpenAI model without changing code; switch
models per agent from the super-admin console or the owner's dashboard.*

- **`AiModel` table** (super-admin `/admin/models`): `provider · modelId · label ·
  tier · enabled · isDefault · sortOrder`. **Adding a model is a data row**, not a
  deploy. Seeded with Gemini 2.5 Flash/Pro.
- **Per-agent selection:** `Agent.aiModelId` → an "AI model" dropdown in the agent
  create/edit form. Null → the capability tier's default (backward compatible).
- **Runtime routing** (`lib/ai/`): the request carries a concrete `model` id;
  every provider uses `req.model ?? resolveModel(tier)`. A chosen model **pins its
  own vendor** — `providerForAgentModel()` / `getProviderForModel()` build that
  vendor from platform creds (`platformProvider()`), so an owner can run one agent
  on **GPT-4o** while the company default stays **managed Gemini/Vertex**. Falls
  back to the default + tier when the pinned vendor isn't configured.
- **Providers:** `vertex` (managed, default), `openai` (new adapter — Chat
  Completions, streaming, tools; platform `OPENAI_API_KEY`), plus `anthropic` /
  `google` BYOK adapters. `AiProviderId` gained `openai`.

Details: [`AI_VERTEX.md`](./AI_VERTEX.md) §"سجل النماذج".

## 4. Business Objects — the sector-generality lever (SHIPPED)

The single biggest lever for "run **any** business." Instead of hard-coding every
entity, the **owner models their own data types** — Patient, Vehicle, Contract,
Case, Property — each with typed fields; the dashboard renders a table + dynamic
form per type, and **the agents get generic tools to read and write records**.

- **Schema:** `ObjectType` (`key · name · icon · fields` JSON) + `ObjectRecord`
  (`data` JSON + denormalized `title`). Field schema is JSON → **adding a field
  needs no migration**. 8 field types (text, long text, number, date, yes/no,
  choice, email, phone).
- **`lib/objects/fields.ts`** is the one place that parses/validates/coerces a
  record against its type's field schema — shared by the UI, the server actions,
  and the agent tools, so every surface agrees on what's valid.
- **UI:** `/data` — a type gallery + a **schema builder** (label · type · required ·
  select options · icon). `/data/[id]` — a records table + dynamic add/edit form.
- **Agent tools** (gated on `CompanyModules.hasObjects`, so context stays lean):
  `list_object_types` → `query_records` → `create_record` / `update_record`. All
  `companyId`-scoped; **excluded from the public widget allow-list** (this data can
  be sensitive — patients), so only dashboard chat + autonomous tasks touch it.

This is what lets a dental clinic, a car workshop, and a law office all run on the
same platform without a code change.

## 5. Agent Work — ops visibility (SHIPPED, ahead of OpenClaw)

`/agent-work` — the surface OpenClaw doesn't give you:
- **Task queue:** every agent task with a status pill, per-status filter + counts,
  agent, attempts, tokens, the `depends_on` chain, a live progress bar, expandable
  result, and Run-now.
- **Scheduled-runs calendar:** a month grid (business-tz, week-start aware) of
  every upcoming run — `AgentSchedule` cron expansions (`expandOccurrences()`) +
  dated tasks — with a selected-day agenda and the recurring-schedule list.

## 6. The gap — ordered next steps

1. **Channels — inbound messaging + a Router agent.** ✅ **Telegram SHIPPED**
   (2026-07-14): owner connects a bot in Settings → Channels; the webhook
   (`/api/channels/telegram/[secret]`, `secret_token`-verified) maps an inbound
   message → the chosen customer-facing agent via `runPublicAgentChat` (same hard
   default-DENY tool allow-list as the widget) → a reply over Telegram. Token
   encrypted; `visitorId = tg:{chatId}` keeps per-chat history. **Next:** WhatsApp
   Cloud API (`ChannelType.WHATSAPP` already reserved) + a lightweight **Router**
   that picks the agent/department per inbound thread (today one agent per channel).
2. **MCP client + per-tenant server registry.** Let an owner register an MCP server
   (URL + auth) and expose its tools to chosen agents — the same `getToolsForAgent`
   gate, tools sourced from a remote MCP instead of the built-in catalogue. This is
   the "connect any third-party" story, done with governance.
3. **Skills as first-class.** Promote reusable capability bundles (prompt +
   allowed tools + example) to a named, versioned unit an owner attaches to an
   agent — composable like OpenClaw skills, but organized.
4. **Agent Studio + test sandbox.** A focused build/test surface (today `/chat` is
   the owner↔agent console; a dedicated sandbox that shows tool calls + which
   model/provider answered would complete create → test → deploy → monitor).

## 7. Design invariants (do not break)

- **The two-layer contract:** the deterministic system owns transactions
  (bookings, orders, money); agents do human/judgment/communication work. New
  capabilities respect this — a channel/MCP tool must still go through the scoped
  tool layer + approvals, never raw DB.
- **`companyId` on every query.** Multi-tenant isolation is non-negotiable.
- **Hard permission gate.** An agent can only call a tool it was handed by
  `getToolsForAgent`. New tools are module/registry-gated, not global-by-default.
- **Public surface is default-deny.** The customer widget has an explicit
  allow-list; sensitive tools (PII, owner data) are never on it.
- **Additive migrations, backward-compatible defaults.** A new column/flag defaults
  to the pre-existing behavior (e.g. `aiModelId` null → tier; `hasObjects` false →
  no object tools).
