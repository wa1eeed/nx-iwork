# NX iWork — Documentation

The documentation map. Each file has **one job**; read by what you need. Layout
follows the [Diátaxis](https://diataxis.fr/) model (explanation · reference ·
how-to · planning) used by most large platforms.

> New here? Read the root [`README.md`](../README.md) first, then
> [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## 🚀 Start here

| Doc | What it is | Read it when |
|---|---|---|
| [`../README.md`](../README.md) | The front door — what the platform is, stack, quickstart, deploy. | First contact. |
| [`../START_HERE.md`](../START_HERE.md) | Short orientation + the invariants + the docs map. | Onboarding (human or AI). |
| [`CONTINUE_HERE.md`](./CONTINUE_HERE.md) | Current state + what's next + invariants. The single "where we left off". | Resuming work. |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Dev setup, conventions, the non-negotiable invariants. | Before your first change. |

## 🧠 Architecture & explanation (the *why*)

| Doc | Scope |
|---|---|
| [`PROJECT.md`](./PROJECT.md) | Project constitution — vision, roles, the core architectural decisions. |
| [`AGENT_SYSTEM.md`](./AGENT_SYSTEM.md) | The agent engine — loop, function-calling tools, 3-layer memory, scheduler, events, conversation modes, per-agent model, Business Objects tools. |
| [`OPENCLAW_PARITY.md`](./OPENCLAW_PARITY.md) | The OpenClaw-parity strategy — positioning, the capability map (us vs OpenClaw), model registry, Business Objects, Agent Work, and the ordered gap (channels · MCP · Skills · Studio). |
| [`AGENT_MODULE_REDESIGN.md`](./AGENT_MODULE_REDESIGN.md) | The 2026-07-16 AI-module overhaul — the config-dedup audit, per-agent governance, editable KPIs, effective capabilities, multi-sector demo tenants, the agent-accuracy fixes, and `/api/version` deploy verification. |

## 📖 Reference (the *what*)

| Doc | Scope |
|---|---|
| [`DATABASE.md`](./DATABASE.md) | Data model / Prisma schema + schema-addition log. |
| [`AI_VERTEX.md`](./AI_VERTEX.md) | AI layer — Vertex, keyless ADC, the token bank, models, in-container test. |
| [`STORAGE.md`](./STORAGE.md) | File storage — R2, the hybrid rule, per-tenant prefixes, presigned URLs, the `File` registry. |
| [`ADMIN.md`](./ADMIN.md) | Super Admin console — access, pages, actions, become-admin. |
| [`INFRA.md`](./INFRA.md) | CDN (Cloudflare), scaling, the Cloud Run migration plan. |

## 🛠️ Operations / how-to (the *how*)

| Doc | Scope |
|---|---|
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Deploy steps + environment (Coolify). README's deploy section is the quick version. |
| [`../SECURITY.md`](../SECURITY.md) | Security model + how to report a vulnerability. |

## 🗺️ Planning & history

| Doc | Scope |
|---|---|
| [`TODO.md`](./TODO.md) | **Live backlog** — what's planned next. |
| [`ROADMAP.md`](./ROADMAP.md) | The forward-looking roadmap — multi-agent phases, billing, infra. |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Change log, newest first ([Keep a Changelog](https://keepachangelog.com/)). |

---

## Documentation conventions

- **One doc, one job.** Don't duplicate; cross-link. If two docs overlap, the
  more specific one owns the detail and the other links to it.
- **`CHANGELOG.md` is the history; `TODO.md` is the future; `CONTINUE_HERE.md` is
  the present.** Keep them in sync when an arc lands.
- **Reference docs track the code.** When you change the schema, the AI layer,
  storage, or admin, update the matching reference doc in the same PR.
- **Additive migrations.** New DB work is an additive migration; record schema
  additions in `DATABASE.md`.
- English is the primary language for engineering docs (newer docs); some older
  docs are Arabic-primary — migrate as touched.
