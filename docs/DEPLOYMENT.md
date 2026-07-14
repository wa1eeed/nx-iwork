# Deployment Guide — NX iWork

> The current, managed-SaaS deploy. Live at **bznss.one** on a single domain
> (path-based: `/`, `/overview`, `/admin`, `/{slug}`). The root
> [`README.md`](../README.md) has the quick version; this is the detailed how-to.
> Infra/scaling and the Cloud Run migration are in [`INFRA.md`](./INFRA.md).

## Stack

Docker (`output: 'standalone'`) on **Coolify** (Hostinger VPS) · PostgreSQL 16 +
pgvector · Cloudflare (DNS/CDN + R2) · managed **Vertex AI** (keyless ADC).

## 1. Database

A PostgreSQL 16 resource (Coolify or managed). Enable the extensions the schema
needs: `vector`, `pg_trgm`, `pgcrypto`. Migrations apply automatically on deploy
(`prisma migrate deploy` in the Dockerfile CMD) — keep them additive.

## 2. Environment variables (Coolify → app)

The full reference is [`.env.example`](../.env.example). The essentials:

```bash
# Names the deployment. staging + production both build with NODE_ENV=production,
# so APP_ENV is what separates them (payment test/live keys, noindex, Sentry tag).
APP_ENV=production          # development | staging | production
NEXT_PUBLIC_APP_ENV=production   # must mirror APP_ENV (browser Sentry tag)

DATABASE_URL=postgres://…
NEXTAUTH_SECRET=…            # openssl rand -base64 32
NEXTAUTH_URL=https://bznss.one
ENCRYPTION_KEY=…             # 64-hex (BYOK encryption)
NEXT_PUBLIC_APP_URL=https://bznss.one

# AI — managed Vertex (keyless ADC). See AI_VERTEX.md.
AI_MODE=managed
GCP_PROJECT_ID=…             # project with Vertex AI API + billing
GCP_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS_JSON=<full ADC JSON>   # gcloud auth application-default login

CRON_SECRET=<random>         # protects /api/cron/run + /api/ai/health

# Super admin bootstrap (ADMIN.md)
ADMIN_EMAIL=admin@bznss.one
ADMIN_PASSWORD=<strong>

# Optional: R2 storage · Resend/Twilio · Tap payments
R2_ENDPOINT= … R2_ACCESS_KEY_ID= … R2_SECRET_ACCESS_KEY= … R2_BUCKET= … R2_PUBLIC_BASE_URL=
TAP_SECRET_KEY=sk_live_…     # sk_test_… on staging, sk_live_… ONLY on production

# Optional: error tracking (no-op unless set). Same project DSN for both.
SENTRY_DSN= …  NEXT_PUBLIC_SENTRY_DSN= …
# SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN  → build-time source-map upload
```

### The three environments

The codebase is env-aware via `APP_ENV` (`lib/env.ts`), so one image serves all three:

| Env | `APP_ENV` | Where | Keys |
|-----|-----------|-------|------|
| **development** | unset / `development` | local Mac (`next dev`) | test / dummy |
| **staging** | `staging` | VPS · Coolify (pre-live) | **test** (`sk_test_…`) |
| **production** | `production` | live `bznss.one` | **live** (`sk_live_…`) |

Give staging and production **separate** databases, R2 buckets, and secrets — never
share prod secrets into staging. The boot log prints a one-line env summary and
**warns loudly** if live payment keys appear in a non-prod env (or vice-versa).

## 3. Domains

- Point **bznss.one** at the app (Cloudflare proxied). Coolify/Caddy handles SSL.
- **Per-tenant custom domains** are supported: the tenant adds an apex A-record to
  `NEXT_PUBLIC_APP_IP`; the platform verifies + serves `/{slug}` content on it.
- File CDN: give the R2 bucket a custom domain (e.g. `cdn.bznss.one`) and set
  `R2_PUBLIC_BASE_URL` to it. See [`INFRA.md`](./INFRA.md).

## 4. Deploy

Push to `origin/main` → Coolify builds the Dockerfile and runs
`prisma migrate deploy && node server.js`. The boot hook seeds/reconciles the
super-admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## 5. Automation (agents act on their own)

Add a Coolify **Scheduled Task**, every minute:

```bash
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://bznss.one/api/cron/run
```

This is **mandatory** — agents only act on their own (scheduled runs, event
wake-ups, due tasks, reminders) while this fires. Each run stamps a heartbeat, so
the **Agent Work** page shows a green "Automation active" pill; if it turns amber,
the cron has stopped — check the Scheduled Task. Every tick also reaps tasks
orphaned in `WORKING` by a restart, so nothing hangs.

## 6. Verify

```bash
curl -o /dev/null -w "%{http_code}\n" https://bznss.one/         # 200
curl -s https://bznss.one/api/health                             # {"ok":true,"env":"production",…} — 200/503; no secrets
curl -H "x-cron-secret: $CRON_SECRET" https://bznss.one/api/ai/health   # {"ok":true,…,"dims":1536}
```

Point the Coolify health check (and an external uptime monitor) at `/api/health` —
it does a DB round-trip and returns 503 when the database is unreachable.

Then sign in at `https://bznss.one/admin` with the bootstrap admin.

## Notes

- The live model is **multi-tenant SaaS** (isolation via `companyId` + RLS). The
  earlier single-tenant / `DEPLOYMENT_MODE` toggle is no longer implemented in code.
- Migration to **Google Cloud Run** is the planned next infra home — see
  [`INFRA.md`](./INFRA.md).
