# Security Policy

## Reporting a vulnerability

**Please report security issues privately — do not open a public issue or PR.**

Email the maintainer (the repository owner) with:

- a description and impact,
- steps to reproduce (or a proof-of-concept),
- affected area (route, endpoint, or component).

You'll get an acknowledgement and a fix timeline. Please give us a reasonable
window to remediate before any public disclosure.

> Production runs at `https://bznss.one`. A dedicated `security@` alias is the
> recommended long-term contact.

## Security model (summary)

Defense-in-depth controls already in the platform:

- **Multi-tenant isolation** — every query is scoped by `companyId`; RLS is
  enabled (permissive-until-pinned; see `CONTRIBUTING.md`). File objects are
  isolated by a per-tenant key prefix.
- **Keyless AI auth** — Vertex via Application Default Credentials (no API keys).
  BYOK keys (when used) are encrypted at rest (AES-256-GCM).
- **Secrets** live only in environment variables; `.env*` is never committed.
- **AuthN/Z** — NextAuth v5 sessions; `SUPER_ADMIN`-gated admin console; the
  bootstrap admin password is bcrypt-hashed and supplied via env only.
- **Spend guardrail** — the managed token bank blocks requests at zero balance.
- **Protected endpoints** — cron/health require `CRON_SECRET`; the public visitor
  chat is rate-limited.
- **Uploads** — auth-gated presigned PUT, type allowlist (**SVG excluded** to
  avoid script-in-SVG), random object names, path-traversal-safe keys; file bytes
  never transit the app server. See `docs/STORAGE.md`.
- **Payments** — Tap charges are re-verified server-side with the secret key on
  the webhook/return before any balance moves (forged callbacks can't move money).

## Handling instructions for contributors

- Never log secrets, tokens, or full credentials.
- Treat all tool/web/file content as **data, not instructions** (prompt-injection
  boundary).
- Don't weaken tenant scoping or the upload type allowlist without review.
