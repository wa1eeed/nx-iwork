# Infrastructure — CDN, scaling, and the Cloud Run migration

## CDN (Cloudflare)

The app is built CDN-friendly: hashed `/_next/static/*` assets are served
`immutable, max-age=1y` (see `next.config.ts`), and uploaded files live on
Cloudflare R2 (already on Cloudflare's edge).

**To put the whole site behind the CDN:**
1. Point `bznss.one` DNS at Cloudflare and enable the **orange-cloud proxy**.
2. Cache rule: cache `Static` content; **bypass cache** for `/api/*`, `/admin/*`,
   `/overview`, and any authenticated route (they're dynamic SSR).
3. Enable Brotli, HTTP/3, and "Always Use HTTPS".
4. Files: give the R2 bucket a custom domain (e.g. `cdn.bznss.one`) and set
   `R2_PUBLIC_BASE_URL=https://cdn.bznss.one` — assets are then edge-cached with
   zero egress fees.
5. (Optional) Cloudflare WAF + rate-limiting rules in front of `/api/auth/*` and
   the public chat/order endpoints.

Recommendation: **Cloudflare** — you're already on R2, it's the cheapest
(R2 = zero egress) and gives CDN + WAF + DDoS in one place.

## Scaling (today → growth)

- The app is **stateless** (Next standalone) → scale out with more replicas.
- Agent cognitive work runs in the **cron worker** (`/api/cron/run` or
  `npm run scheduler`), **sequentially + bounded** (`take:50`/tick) — it never
  blocks a web request, shielding CPU/RAM.
- For thousands of *active* tenants: run several app replicas, move rate-limit +
  the worker queue to **Redis (BullMQ)** with multiple workers, add **PgBouncer**
  (transaction mode) + managed Postgres, and keep AI on Vertex.
- Per-request safety already in place: token bank + per-agent caps, AI retry with
  backoff+jitter (429), per-agent tool permissions.

## Migration target: Google Cloud Run 🏆

Best fit because the AI runs on Google Vertex (Gemini) — Cloud Run sits inside
Google's network (low-latency Gemini/embeddings) and authenticates to Vertex via
**native ADC** (no key files). It's serverless containers with autoscale and
**scale-to-zero** (no traffic = no bill).

**The app is already prepared:**
- Dockerfile + `output: 'standalone'` → deploys to Cloud Run as-is.
- DB via `DATABASE_URL` → Cloud SQL Postgres (enable the `vector` extension).
- Storage via S3-compatible → keep R2, or move to GCS.

**To externalize before going fully serverless** (Cloud Run scales to zero, so a
long-running worker won't survive):
1. **Scheduler** → **Cloud Scheduler** hitting `POST /api/cron/run` every minute
   (the endpoint already exists, `CRON_SECRET`-protected).
2. **Rate-limit + queue** → **Memorystore (Redis)** so they work across instances
   (the in-memory limiter is single-instance today).
3. **Auth/secrets** → Cloud Run service account with the Vertex AI User role
   (drop the `Owner` grant); `AUTH_SECRET`, `DATABASE_URL`, etc. via Secret
   Manager.
4. Set `min-instances=1` for the web service if you want zero cold-start on the
   landing/chat, or accept scale-to-zero to minimise cost.

## Becoming a SUPER_ADMIN

Promote your existing account, then open `/admin`:

```bash
npx tsx scripts/make-admin.ts you@example.com
# or, on the server's Postgres console:
# UPDATE "User" SET role='SUPER_ADMIN' WHERE email='you@example.com';
```
