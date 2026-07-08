# NX iWork - Project Constitution

> **هذا الملف هو المرجع الأول والأساسي للمشروع.** اقرأه كاملاً قبل أي تطوير.

---

## 1. نظرة عامة

**الاسم:** NX iWork

**الوصف:** منصة تمكّن أصحاب الأعمال من بناء شركة كاملة من موظفين ذكاء اصطناعي يعملون في أقسام، ينفذون مهام، ولديهم ذاكرة طويلة المدى.

**النموذج التجاري:** **SaaS مُدار** — حيّ الآن على **bznss.one**. اشتراكات شهرية
(باقات Starter/Growth/Scale) + **بنك توكنز** مُدار للذكاء + **محفظة** (SAR) + **سوق
خدمات/إضافات**. (التوجه القديم «بيع نسخ مرخصة» تم استبداله بالـ SaaS المُدار.)

**السوق:** السعودية أولاً، ثم الخليج، ثم عالمياً.

**اللغات:** عربي (Tajawal) + إنجليزي (Inter)، قابل للتعطيل من Settings.

---

## 2. القيم الأساسية

1. **البساطة لصاحب البزنس** - رائد الأعمال غير تقني
2. **القابلية للنسخ** - بنية تدعم بيع نسخ بدون عناء
3. **الأمان أولاً** - تشفير، عزل، 2FA
4. **المرونة الكاملة** - كل شي قابل للتخصيص (لغة، عملة، تاريخ، ثيم)
5. **الذكاء الحقيقي** - موظفين أذكياء بذاكرة، مش chatbots

---

## 3. Tech Stack

### Frontend
- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Tajawal + Inter fonts
- next-intl للترجمة
- framer-motion للحركات
- lucide-react للأيقونات

### Backend
- Next.js API Routes + Server Actions
- Prisma ORM
- PostgreSQL 16 + pgvector (للـ semantic memory)
- NextAuth.js v5
- bcryptjs

### AI (Provider-Agnostic)
- **طبقة محايدة** (`lib/ai/`) — واجهة موحّدة، وباقي الكود لا يستورد أي SDK مزوّد
- **افتراضياً Managed عبر Google Vertex** (Gemini 2.5) بمصادقة **ADC بلا مفاتيح**،
  والمحاسبة عبر **بنك توكنز** لكل شركة. **BYOK** خيار اختياري (مفتاح الشركة مشفّر،
  Gemini/Claude). انظر [`AI_VERTEX.md`](./AI_VERTEX.md).
- **استدعاء الدوال (Function Calling):** الوكلاء ينفّذون أدوات (كتالوج، CRM، مهام) بدل الاكتفاء بالمحادثة — قراءة منظمة بدل PDF لتوفير التوكنز
- Model tiers مجرّدة (Fast/Balanced/Advanced) تُترجم لمعرّف نموذج لكل مزوّد (`lib/ai/models.ts`)

### Integrations (طبقات محايدة معزولة — تطوير أي واحدة لا يلمس الباقي)
- **Cloudflare R2** (تخزين S3-compatible، رفع presigned مباشر بلا مرور على الـ VPS، مبدأ هجين + كوتا + ضغط صور) — `lib/storage/` ✅
- **Resend** (إيميل مركزي + **مُرسِل per-tenant**: اسم/reply-to/تسويق) + **Twilio** (SMS اختياري) + Telegram (تصعيد) — `lib/notifications/` ✅
- **Embeddings** (Google Gemini `gemini-embedding-001` @ 1536، HNSW) للذاكرة الدلالية — `lib/ai/embeddings.ts` ✅
- **Tap.company** (شحن المحفظة + دفع الاشتراكات بالبطاقة/Apple Pay) — ✅ مُنفّذ (التجديد التلقائي مخطّط)
- **Sentry** (تتبّع أخطاء، موسوم بـ `APP_ENV`) + `GET /api/health` + **ثلاث بيئات** عبر `APP_ENV` (`lib/env.ts`) — ✅ مُنفّذ
- **API عام v1** لتكامل أطراف ثالثة — مخطّط

### DevOps
- Docker (multi-stage)
- Coolify (self-hosted PaaS)
- Caddy (reverse proxy + auto SSL)
- GitHub + Actions

---

## 4. الأدوار في النظام

### 1. Super Admin (وليد)
- وصول لكل شي عبر `/admin` (لوحة السوبر أدمن — انظر [`ADMIN.md`](./ADMIN.md))
- إدارة الشركات، الباقات، أرصدة التوكنز، سقوف التخزين، إعدادات المنصّة
- اعتماد managed (Vertex) عبر service account واحد — لا مفاتيح API مكشوفة

### 2. Business Owner
- صاحب الشركة (المشترك)
- لوحة التحكم على `bznss.one` (مسارات `/overview`, `/agents`, …)
- يضيف موظفين، أقسام، خدمات، منتجات

### 3. Business Member
- موظف بشري في الشركة
- صلاحيات محدودة حسب ما يحدد الـ Owner

### 4. AI Agent
- ليس مستخدماً، كيان داخل النظام
- له شخصية، ذاكرة، صلاحيات

### 5. Visitor
- زائر الموقع العام (`bznss.one/{slug}` أو النطاق المخصّص للشركة)
- يتفاعل مع AI Agents عبر chat widget

---

## 5. الميزات الجوهرية

### للـ Business Owner

**إدارة الموظفين:**
- إنشاء AI Agent بشخصية وأدوار
- ربط بقسم ومدير
- إعطاء System Prompt + Skills
- مراقبة الأداء (3 tabs + Timeline)

**إدارة المهام:**
- تكليف موظف بمهمة
- متابعة التقدم
- مراجعة النتيجة
- Approvals للقرارات الحساسة

**المحادثة:**
- chat مباشر مع أي موظف
- Streaming من Claude
- ذاكرة طويلة المدى

**الإعدادات (Configurable):**
- اللغة: عربي/إنجليزي/الاثنين
- العملة: SAR/USD/AED/EUR/GBP
- التاريخ: ميلادي/هجري/الاثنين
- التوقيت: Asia/Riyadh وغيره
- الثيم: Dark/Light
- Branding: شعار، ألوان، اسم

**الفرونت إند العام:**
- Landing page موحدة قابلة للتخصيص
- Hero (نص+صورة أو slider)
- خدمات (مع طلب من الزائر)
- منتجات (مع cart + checkout)
- Chat widget في الزاوية
- Custom Domain support

### للـ Super Admin

**Dashboard:**
- إجمالي الإيرادات
- العملاء النشطين
- استخدام النظام

**إدارة العملاء:**
- قائمة، تفاصيل، تعليق، حذف

**إعدادات المنصة:**
- Branding عام
- Feature flags
- وضع الصيانة

---

## 6. القرارات المعمارية

### قرار 1: Multi-Tenancy من اليوم الأول
**القرار:** Shared Database, Shared Schema with `companyId` isolation
**ليش:** يدعم النموذج المزدوج (نسخ + SaaS) بنفس الكود

### قرار 2: نموذج ذكاء مزدوج — Managed (افتراضي) + BYOK (اختياري)
**القرار:** الافتراضي **managed**: المنصة تتصل بـ **Google Vertex** (Gemini 2.5) عبر service account واحد ومصادقة **ADC بلا مفاتيح**، وتُحاسِب كل شركة عبر **بنك توكنز** (`Company.tokenBalance`) — المنصة تدفع لجوجل. و**BYOK** خيار اختياري: الشركة تضع مفتاحها (مشفّر AES-256-GCM) وتختار المزوّد (Gemini/Claude) وتدفع مباشرة.
**ليش:** managed يعطي تجربة جاهزة بلا إعداد للعميل، والمنصة تتحكم بالتكلفة عبر بنك التوكنز؛ وBYOK يبقى لمن يريد مفتاحه/مزوّده (التكلفة عليه). الطبقة محايدة (`lib/ai/`) فالتبديل = ملف واحد.
**⚠️ تحديث القرار:** سابقاً كان التوجه **BYOK-أولاً**؛ تحوّلنا إلى **managed-أولاً عبر Vertex + بنك توكنز** بعد اعتماد سياسة جوجل keyless ونموذج الـ SaaS المُدار. المرجع الحالي: [`../README.md`](../README.md) و[`AI_VERTEX.md`](./AI_VERTEX.md).

### قرار 2-ب: نموذج بيانات مرن لأي نشاط
**القرار:** جداول أساسية ثابتة (Customer/Service/Product/Task) + حقل `customFields` (JSON) في كل منها
**ليش:** نشاط واحد (عقار/حجوزات/خدمات/متاجر) يضيف خصائصه (عدد الغرف، وقت الوصول، الميزانية) دون أي تعديل على الـ schema أو الكود.

### قرار 2-ج: نظام مهام موحّد (قائمة/تقويم)
**القرار:** جدول `Task` واحد بأنواع (`TaskKind`: AGENT_TASK / APPOINTMENT / REMINDER) + `startAt/endAt`
**ليش:** يخدم مهام الوكلاء ومواعيد العملاء والتذكيرات معاً، يُعرض كقائمة أو تقويم، ويربط بالـ CRM.

### قرار 3: Agent Loop المتقدم
**القرار:** كل موظف له:
1. **Working Memory** (آخر 20 رسالة في context)
2. **Episodic Memory** (كل المهام في DB)
3. **Semantic Memory** (vector embeddings في pgvector)
4. **Wake Triggers** (events تنبّهه: مهمة، رسالة، schedule، webhook)

### قرار 4: Skills & Tools System
**القرار:** كل موظف عنده Tools (أدوات تنفيذية عبر function-calling) + Skills (قدرات قابلة للتركيب)
- Tools: أدوات **داخلية مباشرة** (كتالوج، CRM، مهام، ذاكرة) مبوّبة عبر `getToolsForAgent` (module ∩ `permissions`) — والنموذج لا يصل لأي أداة لم تُسلَّم له (بوابة صارمة).
- Skills: قدرات متخصّصة قابلة للتركيب — **نظام Skills مخطّط** (المرحلة 2 من معمارية الوكلاء).

### قرار 5: العقد ثنائي الطبقة (النظام مقابل الوكلاء)
**القرار:** **النظام** (كود حتمي داخل الوورك فلو) يملك المعاملات — الفواتير، الحجوزات، الطلبات، سجلات CRM — برمجياً وبموثوقية. و**الوكلاء** يؤدّون العمل الإنساني: الحكم، التواصل باللغة الطبيعية (مع العملاء وفيما بينهم)، الغموض، المبادرة، التنسيق بين الأقسام. الوكيل يُدرِك حالة النظام، يقرّر ضمن السياسة، يتواصل، و**يشغّل** الوورك فلو — ولا «يسجّل الفاتورة» بنفسه (النظام يفعل ذلك).
**ليش:** يمنع الوكلاء الزائدين — كل وكيل مبرَّر فقط حيث يلزم الحكم/التواصل/المبادرة. (يحلّ محل قرار n8n القديم المُلغى؛ الأدوات الأساسية داخلية لا خارجية.)

### قرار 6: Configurable Settings
**القرار:** كل شي قابل للتخصيص من Settings:
- اللغة (en/ar/both)
- العملة + التاريخ + التوقيت
- الثيم
- Branding
**ليش:** يدعم بيع نسخ بـ branding مختلف، ويسهّل التوسع عالمياً

### قرار 7: النموذج = SaaS متعدّد المستأجرين + ثلاث بيئات
**القرار:** المنصة الحيّة **SaaS متعدّد المستأجرين** (عزل عبر `companyId` + RLS)، تعمل عبر **ثلاث بيئات** (development/staging/production) يميّزها `APP_ENV` (`lib/env.ts`) — لأن `NODE_ENV` لا يفرّق staging عن production. وحدة واحدة على bznss.one، مسارات path-based.
**ليش:** نموذج واحد مُدار مركزياً، وبيئات معزولة الأسرار/المفاتيح (test مقابل live). (وضع single-tenant لم يعد مُنفَّذاً في الكود.)

### قرار 8: Custom Domain Support
**القرار:** العميل يوجّه دومينه (A-record للـ apex) والمنصة تتحقّق منه وتخدم `/{slug}` عليه؛ SSL يُدار عبر Coolify/Caddy.
**ليش:** صاحب البزنس يربط دومينه الخاص بسهولة.

### قرار 9: Data Sovereignty
**القرار:** كل البيانات على VPS في السعودية
**ليش:** متطلبات السوق السعودي ورؤية 2030

---

## 7. هيكل المشروع

```
nx-iwork/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # تسجيل الدخول
│   │   ├── login/
│   │   ├── signup/
│   │   └── onboarding/
│   ├── (dashboard)/              # لوحة Business Owner
│   │   ├── overview/
│   │   ├── agents/
│   │   ├── departments/
│   │   ├── tasks/
│   │   ├── chat/
│   │   ├── orders/
│   │   ├── services/
│   │   ├── products/
│   │   └── settings/
│   ├── (admin)/                  # لوحة Super Admin
│   │   └── admin/
│   ├── (public)/                 # الصفحة العامة
│   │   └── [businessSlug]/
│   ├── api/
│   └── page.tsx                  # marketing landing (/) + SEO/JSON-LD
├── components/
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── claude/                   # Agent Loop logic
│   ├── memory/                   # 3-layer memory system
│   ├── encryption.ts
│   ├── i18n/
│   └── tenant.ts                 # Multi-tenant helpers
├── prisma/
├── public/
├── styles/
├── tests/
├── docker/
└── docs/
```

---

## 8. مبادئ التطوير

1. **ميزة واحدة كل مرة** - ما نبني ميزات متوازية
2. **اختبار قبل الانتقال** - كل feature تشتغل قبل التالية
3. **Git بعد كل ميزة** - commits صغيرة وواضحة
4. **توثيق فوري** - CHANGELOG.md محدّث
5. **اسأل قبل القرارات الكبيرة** - وليد لازم يوافق

---

## 9. التكاليف المتوقعة

### للبدء:
- VPS Coolify: 100 SAR/شهر
- Domain (bznss.one): ~200 SAR/سنة
- Claude API (BYOK من العملاء): 0
- **المجموع: ~120 SAR/شهر**

### بعد بيع 5 نسخ:
- إيرادات: 200,000+ SAR
- تكاليف ثابتة: 500 SAR/شهر
- **هامش ربح: ~98%**

---

## 10. حالة التنفيذ (مُنجز)

النواة الأساسية للمنصة **مكتملة ومنشورة**:

| القدرة | الحالة | المكان |
|---|---|---|
| طبقة AI محايدة (Vertex/Gemini افتراضي مُدار، BYOK اختياري) | ✅ | `lib/ai/` |
| وضع Managed: Vertex AI + بنك توكنز (`AI_MODE=managed`، **افتراضي**) | ✅ مُتحقَّق حيّاً | `lib/ai/providers/vertex.ts`, `lib/billing/tokens.ts` — مرجع: `docs/AI_VERTEX.md` |
| محادثة الوكيل + استدعاء الأدوات (catalog/CRM/tasks/memory) | ✅ | `lib/agent/run.ts`, `tools.ts` |
| نموذج بيانات مرن: CRM (Customer) + customFields + Task موحّد | ✅ | `prisma/schema.prisma` |
| إدارة الأقسام والوكلاء + بناء الشخصية | ✅ | `app/(dashboard)/agents`, `departments` |
| محرّك تنفيذ المهام (دورة حياة + محاولات + Timeline) | ✅ | `lib/agent/task.ts`, `core.ts` |
| المشغّلات والجدولة (worker مستقل) | ✅ | `lib/agent/scheduler.ts`, `scripts/scheduler.ts` |
| الذاكرة (semantic via pgvector + fallback) | ✅ | `lib/agent/memory.ts`, `lib/ai/embeddings.ts` |
| تخزين R2 + كتالوج المنتجات | ✅ | `lib/storage/`, `app/(dashboard)/products` |
| الإشعارات: إيميل per-tenant (Resend) + SMS (Twilio اختياري) + تصعيد (Telegram) | ✅ | `lib/notifications/`, `tenant-email.ts` |
| اللاندنغ بيج العامة + ودجت الوكيل | ✅ | `app/(public)/[slug]` |
| لاندنغ تسويقية + SEO/JSON-LD على `/` | ✅ | `app/page.tsx` |
| تصميم جوال (كاروسيل أقسام + شريط سفلي) | ✅ | `components/dashboard/mobile-*` |
| الـ CRM: الفرص (Pipeline/Kanban + 360°) + الطلبات + دليل العملاء | ✅ | `app/(dashboard)/customers`, `clients` |
| المحفظة (SAR) + شحن Tap + شراء توكنز | ✅ | `app/(dashboard)/wallet`, `lib/wallet.ts` |
| الاشتراكات (باقات + ترقية + فواتير، دفع محفظة/Tap) | ✅ | `app/(dashboard)/subscription` |
| سوق الخدمات/الإضافات + شراء بالمحفظة + إضافة مساحة | ✅ | `app/(dashboard)/services`, `lib/marketplace.ts` |
| حصص التخزين متعددة المستأجرين + ضغط الصور (sharp) | ✅ | `lib/storage/quota.ts`, `image.ts` — `docs/STORAGE.md` |
| لوحة السوبر أدمن (شركات/باقات/توكنز/تخزين/متجر/إعدادات) | ✅ | `app/(admin)/admin` — `docs/ADMIN.md` |
| Sentry + `GET /api/health` + ثلاث بيئات (`APP_ENV`) | ✅ | `lib/env.ts`, `sentry.*.config.ts`, `app/api/health` — `docs/DEPLOYMENT.md` |
| **معمارية الوكلاء متعددة المراحل** (دستور Job Description + مصفوفة صلاحيات per-department + Skills + تنسيق) | ⬜ مخطّط (الحدث القادم) | `docs/AGENT_SYSTEM.md` |
| تجديد الاشتراك التلقائي (Tap) · API عام v1 | ⬜ لاحقاً | — |

**التشغيل:** الويب عبر `Dockerfile` (يشغّل `prisma migrate deploy` تلقائياً)، والجدولة كخدمة ثانية `npm run scheduler` (نسخة واحدة).

---

## 11. روابط مهمة

- **Anthropic Docs:** https://docs.claude.com
- **Google Gemini API:** https://ai.google.dev/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Coolify Docs:** https://coolify.io/docs

---

**آخر تحديث:** 8 يوليو 2026
**النسخة:** 0.1.0 NX iWork
**المؤلف:** وليد + Claude Opus
