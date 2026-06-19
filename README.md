# NX iWork 🤖

> منصة SaaS تتيح لرواد الأعمال بناء **شركة كاملة من موظفي ذكاء اصطناعي** — أقسام،
> موظفون بشخصيات وذاكرة، ينفّذون المهام ويتحركون تلقائياً. صُممت للسوق السعودي
> أولاً، عالمية في الجوهر.

[![Status](https://img.shields.io/badge/status-live-brightgreen)](https://bznss.one/)
[![AI](https://img.shields.io/badge/AI-Google%20Vertex%20(Gemini%202.5)-4285F4)](.)
[![License](https://img.shields.io/badge/license-proprietary-red)](.)

🌐 **Live:** [bznss.one](https://bznss.one/)

---

## 🎯 ما هي المنصة؟

تتيح لأي صاحب بزنس بناء **طاقم عمل افتراضي** ذكي:

- 🤖 **موظفون أذكياء حقيقيون** — شخصية، مستوى نموذج، ومدير، وذاكرة طويلة المدى
- 🛠️ **ينفّذون لا يدردشون فقط** — عبر Function Calling: يقرأون الكتالوج والأسئلة
  الشائعة، يسجّلون العملاء في الـ CRM، ينشئون المهام والحجوزات
- ⏰ **يتحركون تلقائياً** — جدولة زمنية (Cron) + **مشغّلات أحداث** (عميل جديد → يصحى
  وكيل المبيعات)
- 🧠 **يتذكّرون** — ذاكرة دلالية عبر pgvector
- 🧩 **معمارية نمطية** — موديولات تُفعَّل حسب النشاط (تجارة / حجوزات / خدمات)،
  والوكيل يحصل **أدوات الموديولات المفعّلة فقط**
- 🗂️ **أنظمة مدمجة** — CRM، مهام/تقويم، كتالوج، قاعدة معرفة (FAQ)
- 🌐 **صفحة عامة لكل بزنس** (`/{slug}`) مع **ودجت شات** يكلّم وكيل خدمة العملاء
- 🇸🇦 سياق سعودي (عربي/إنجليزي، Tajawal، RTL)

---

## 🧠 طبقة الذكاء — Managed (افتراضي) عبر Google Vertex AI

المنصة تعمل بوضعين عبر `AI_MODE`:

| الوضع | الوصف | الفوترة |
|---|---|---|
| **`managed`** (افتراضي) | المنصة تتصل بـ **Vertex AI** (Gemini 2.5) عبر **service account واحد** | **بنك توكنز** لكل شركة (`Company.tokenBalance`) — المنصة تدفع لجوجل |
| `byok` (اختياري) | كل شركة تجلب مفتاحها (Gemini/Claude) | العميل يدفع مباشرة |

- **مصادقة Keyless (ADC):** لا مفاتيح API (سياسة جوجل 2026). على VPS، يُلصق محتوى
  ملف ADC كمتغيّر `GOOGLE_APPLICATION_CREDENTIALS_JSON` ويُكتب لملف مؤقت تلقائياً.
- **طبقة محايدة** (`lib/ai/`): واجهة `AiProvider` واحدة + محوّلات (Vertex / Google
  AI Studio / Anthropic). تبديل المزوّد = ملف واحد.
- **embeddings** عبر Vertex (`gemini-embedding-001` @ 1536).
- المرجع الكامل: **[docs/AI_VERTEX.md](./docs/AI_VERTEX.md)**.

---

## 🏗️ Tech Stack

- **Frontend:** Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui ·
  next-intl (ar/en, RTL) · Tajawal/Inter
- **Backend:** Next.js API Routes + Server Actions · Prisma · PostgreSQL 16 + pgvector · NextAuth v5
- **AI:** Google **Vertex AI** (Gemini 2.5 flash/pro) + embeddings · Function Calling · ذاكرة 3 طبقات
- **التكاملات:** Cloudflare R2 (تخزين، presigned) · Resend + Twilio (إشعارات)
- **DevOps:** Docker + Coolify على VPS (Hostinger) · Caddy (auto SSL) · قابل للنقل لـ Cloud Run/ECS/OSS

---

## 📂 هيكل المشروع

```
app/
├── (dashboard)/            ← لوحة تحكم رائد الأعمال
│   ├── overview · agents · departments · products · bookings
│   ├── knowledge (FAQ + triggers) · tasks · chat · modules · settings
├── (public)/[slug]/        ← الصفحة العامة لكل بزنس + ودجت الوكيل
├── (auth)/ · (onboarding)/
└── api/
    ├── agents/[id]/chat · tasks/[id]/run
    ├── public/[slug]/chat  ← محادثة الزوار
    ├── cron/run · ai/health (محميان بـ CRON_SECRET)
lib/
├── ai/                     ⭐ الطبقة المحايدة (vertex/google/anthropic) + embeddings + gcp-auth (ADC)
├── agent/                  ⭐ القلب: core · run · task · scheduler · events · memory · tools · prompt
├── billing/tokens.ts       ← بنك التوكنز (managed)
├── storage/ · notifications/ · actions/
prisma/schema.prisma · scripts/scheduler.ts · docs/
```

---

## ⚙️ التشغيل والنشر (Managed)

**متغيّرات البيئة (Coolify):**
```bash
DATABASE_URL=...            NEXTAUTH_SECRET=...     ENCRYPTION_KEY=...   # 64-hex
AI_MODE=managed
GCP_PROJECT_ID=<مشروع فيه Vertex AI API + Billing>
GCP_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS_JSON=<محتوى ملف ADC كاملاً>   # من gcloud auth application-default login
CRON_SECRET=<سر عشوائي>
# اختياري: R2_* · RESEND_API_KEY/EMAIL_FROM · TWILIO_*
```

**النشر:** الـ `Dockerfile` يشغّل `prisma migrate deploy` تلقائياً ثم التطبيق.

**الأتمتة (الوكلاء يتحركون تلقائياً):** أضف Scheduled Task في Coolify كل دقيقة:
```bash
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" https://<domain>/api/cron/run
```

**التحقق من الذكاء (داخل الخادم):**
```bash
curl -H "x-cron-secret: $CRON_SECRET" https://<domain>/api/ai/health   # متوقّع {"ok":true,...dims:1536}
```

---

## 📚 الوثائق

| ملف | المحتوى |
|---|---|
| [docs/AI_VERTEX.md](./docs/AI_VERTEX.md) | **مرجع طبقة الذكاء** (Vertex، ADC، بنك التوكنز، النماذج، الاختبار) |
| [docs/PROJECT.md](./docs/PROJECT.md) | دستور المشروع + حالة التنفيذ |
| [docs/AGENT_SYSTEM.md](./docs/AGENT_SYSTEM.md) | قلب نظام الوكلاء |
| [docs/DATABASE.md](./docs/DATABASE.md) | مخطط البيانات |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | النشر |
| [docs/TODO.md](./docs/TODO.md) | المهام القادمة (لوحة Super Admin، Tap، إلخ) |
| [CHANGELOG.md](./CHANGELOG.md) | سجل التغييرات |

---

## 🔒 الأمن

- ✅ Keyless ADC (لا مفاتيح API) · أسرار في env فقط (لا تُرفع على Git)
- ✅ تشفير BYOK keys (AES-256-GCM) عند استخدام BYOK
- ✅ عزل Multi-tenant (`companyId`) في كل استعلام
- ✅ بنك توكنز يحدّ استهلاك managed (HTTP 402 عند النفاد)
- ✅ endpoints حسّاسة محمية (CRON_SECRET) · محادثة الزوار بـ rate limiting

---

© 2026 NX iWork — جميع الحقوق محفوظة. **صُمّم بحبٍ في 🇸🇦**
