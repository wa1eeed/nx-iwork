# File storage architecture

> How NX iWork stores tenant files. This is the **as-built** reality (verified
> against the code), followed by an honest gap list. Pattern: *decouple the file
> body from its identity* — exactly what Shopify / Slack / Notion / Salesforce do.

## TL;DR

The file **body** goes to object storage (Cloudflare R2, S3-compatible); the app
server only **signs** the transfer and never proxies the bytes. Tenants are
isolated by a per-company key **prefix**. The storage layer is provider-agnostic
(`lib/storage/`), so R2 → AWS S3 → Alibaba OSS is an endpoint + credentials change.

```
client ──(presigned PUT)──▶  Cloudflare R2 bucket
   ▲                          companies/<companyId>/<purpose>/<uuid>.<ext>
   │ presigned URL
   └── app server (signs only; bytes never transit the VPS)
```

## 1) The body → object storage (R2)

- **Provider-agnostic interface:** `lib/storage/types.ts` (`StorageProvider`) — business
  code never touches a vendor SDK. R2 adapter: `lib/storage/r2.ts` (AWS S3 v3 SDK
  pointed at R2). Swap to S3/OSS = change `R2_ENDPOINT` + keys only.
- **Direct-to-bucket uploads:** `app/api/uploads/sign/route.ts` mints a **presigned
  PUT** URL; the browser uploads straight to R2 (`components/dashboard/image-upload.tsx`).
  The file bytes **never touch the app server / VPS** — storage scales independently.
- **Per-tenant prefix (isolation):** `companyKey(companyId, ...parts)` →
  `companies/<companyId>/<purpose>/<uuid>.<ext>`. The prefix is computed **server-side
  from the authenticated user's company** — a client cannot target another tenant's
  prefix. Keys are sanitised (no `..`, no path traversal, safe chars only).
- **Random object names:** `randomUUID()` filenames → no collisions, no guessable URLs.
- **Type allowlist + security:** only `image/png|jpeg|webp|gif` and `application/pdf`.
  **SVG is excluded on purpose** (script-in-SVG XSS risk).
- **CDN:** the public bucket is served via a Cloudflare custom domain
  (`R2_PUBLIC_BASE_URL`, e.g. `cdn.bznss.one`) → edge-cached, zero egress.

## 2) The identity → the database (the hybrid rule)

The DB stays **light** because it never holds file bytes — only the **reference**:

- **File body** → R2 (image, PDF, …).
- **URL/key** → a plain **text** column on the owning record. Verified examples:
  `Company.logo`, `Company.logoUrl`, `User.image`, `Product.images String[]`,
  `Invoice.pdfUrl` — all `String`/`String[]`. The bytes are never in Postgres
  (no `bytea`/Buffer/base64 anywhere in the schema — checked).

### The one exception: AI embeddings (pgvector)

The only thing we store **deep** in the DB is the numeric **vectors** Gemini
produces from a tenant's knowledge text — because they're math, not files, and the
agent compares them by similarity for fast retrieval:

- `AgentMemory.embedding Unsupported("vector(1536)")` (pgvector, HNSW index).
- `lib/agent/memory.ts`: `getEmbedding(summary)` → stored as `::vector`. We embed
  the **text summary**; the **original uploaded file stays in R2**.

So: Postgres holds tiny references + vectors and stays MB-sized; the actual files
live in R2 (effectively unlimited, zero-egress). This is the exact hybrid the
global platforms use.

## 3) Private files & temporary signed links

The storage layer already supports **presigned GET** (`createDownloadUrl(key,
expiresIn)`, default 300s) — the Slack/Notion pattern: a private object is only
reachable through a short-lived signed URL that expires. The **capability exists**;
a full private-document flow (private bucket + signed-download-only + per-file
access checks) is **not wired yet** — current uploads are public assets (logos,
product images).

## Comparison vs the global standard

| Dimension | Global standard | NX iWork (as built) |
|---|---|---|
| Storage location | Independent object store (R2/S3) | ✅ Cloudflare R2 |
| Body path | Direct to bucket, presigned; bytes skip app | ✅ Presigned PUT, bytes skip the VPS |
| Tenant isolation | Per-tenant key prefix | ✅ `companies/<companyId>/…`, server-enforced |
| Portability | Vendor-swappable | ✅ S3-compatible interface |
| CDN delivery | Edge-cached | ✅ R2 public domain on Cloudflare |
| Upload security | Auth + type/size limits | ✅ Auth + type allowlist · ⚠️ no server-side size cap |
| Body vs DB | URL reference in DB, bytes in store | ✅ URL as text; **no bytes in Postgres** |
| AI embeddings | Vectors in DB, file in store | ✅ `vector(1536)` in pgvector; file in R2 |
| File metadata (uuid/size/mime) | Optional central `tenant_files` table | ➖ Not yet — fine without it; useful for audit/quota |
| Private files | Private bucket + signed-only + access control | ⚠️ Capability present; flow not wired |

**Verdict:** the core architecture — the **hybrid rule** (file → R2, URL → text,
vectors → pgvector, **zero bytes in the DB**), per-tenant isolation, presigned
direct uploads, provider portability, CDN — is **fully in place and competitive**.
A central files table is an **optional** enhancement (it stores references +
metadata, never bytes, so the DB stays light); private files + a size cap remain.

## Gaps / roadmap

1. **(Optional) central `tenant_files` metadata table** — `File { id, companyId,
   key, url, purpose, mime, size, uploadedById, createdAt }`, RLS on `companyId`.
   Stores **references + metadata only, never bytes** — the DB stays light. Not
   required for correctness (URL-as-text already works); it adds audit, quota,
   orphan cleanup, and per-tenant file listing.
2. **Private / confidential files** — a private bucket (or private prefix), served
   only via short-lived `createDownloadUrl`, with a per-file access check. For
   customer documents / financial reports.
3. **Server-side size cap** — switch presigned **PUT** → presigned **POST** with a
   `content-length-range` policy so the bucket itself rejects oversized uploads.

## Env

```
R2_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="…"
R2_SECRET_ACCESS_KEY="…"
R2_BUCKET="…"
R2_PUBLIC_BASE_URL="https://cdn.bznss.one"   # public bucket custom domain (CDN)
```

Without these, `isStorageConfigured()` is false and the upload route returns
`503 storage_not_configured` (the UI shows "storage not set up").
