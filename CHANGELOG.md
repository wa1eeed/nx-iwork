# Changelog

All notable changes to NX iWork are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

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
