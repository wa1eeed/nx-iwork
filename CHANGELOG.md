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
