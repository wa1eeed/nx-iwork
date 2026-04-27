# NX iWork - Project Constitution

> **هذا الملف هو المرجع الأول والأساسي للمشروع.** اقرأه كاملاً قبل أي تطوير.

---

## 1. نظرة عامة

**الاسم:** NX iWork

**الوصف:** منصة تمكّن أصحاب الأعمال من بناء شركة كاملة من موظفين ذكاء اصطناعي يعملون في أقسام، ينفذون مهام، ولديهم ذاكرة طويلة المدى.

**النموذج التجاري المزدوج:**
- **بيع نسخ مرخصة** (شهر 1-2): 25K-100K SAR للنسخة
- **SaaS** (شهر 3+): اشتراكات شهرية على nx.sa

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
- Next.js 15 (App Router)
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

### AI
- Anthropic SDK (`@anthropic-ai/sdk`)
- BYOK مفتاح من العميل
- Models: Haiku (سريع/رخيص) / Sonnet (متوسط) / Opus (متقدم)

### Integrations
- Resend (Email)
- n8n (External workflows - lazy load)
- Moyasar (Payment للـ SaaS phase)
- Cloudflare R2 / S3-compatible (file storage)

### DevOps
- Docker (multi-stage)
- Coolify (self-hosted PaaS)
- Caddy (reverse proxy + auto SSL)
- GitHub + Actions

---

## 4. الأدوار في النظام

### 1. Super Admin (وليد)
- وصول لكل شي في `admin.nx.sa`
- إدارة العملاء (في SaaS mode)
- مفاتيح API الرئيسية (لو فعّل managed mode لاحقاً)

### 2. Business Owner
- صاحب الشركة (المشترك)
- لوحة التحكم في `app.nx.sa`
- يضيف موظفين، أقسام، خدمات، منتجات

### 3. Business Member
- موظف بشري في الشركة
- صلاحيات محدودة حسب ما يحدد الـ Owner

### 4. AI Agent
- ليس مستخدماً، كيان داخل النظام
- له شخصية، ذاكرة، صلاحيات

### 5. Visitor
- زائر الموقع العام (`nx.sa/{slug}`)
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

### قرار 2: BYOK فقط
**القرار:** كل عميل يضع مفتاح Claude الخاص به (مشفّر AES-256-GCM)
**ليش:** يلغي تعقيد credits/billing API، ويوفر 4-5 sprints

### قرار 3: Agent Loop المتقدم
**القرار:** كل موظف له:
1. **Working Memory** (آخر 20 رسالة في context)
2. **Episodic Memory** (كل المهام في DB)
3. **Semantic Memory** (vector embeddings في pgvector)
4. **Wake Triggers** (events تنبّهه: مهمة، رسالة، schedule، webhook)

### قرار 4: Skills & Tools System
**القرار:** كل موظف عنده Skills (capabilities) + Tools (executable)
- Skills: فهم سياق محدد (مثلاً: "ZATCA Invoice")
- Tools: قدرة تنفيذية (n8n workflow, API call, DB query)

### قرار 5: n8n كذراع تنفيذي خارجي فقط
**القرار:** n8n للـ workflows المعقدة (social media, emails, integrations)
**ليش:** نخلي القلب في NX، n8n للأدوات الخارجية

### قرار 6: Configurable Settings
**القرار:** كل شي قابل للتخصيص من Settings:
- اللغة (en/ar/both)
- العملة + التاريخ + التوقيت
- الثيم
- Branding
**ليش:** يدعم بيع نسخ بـ branding مختلف، ويسهّل التوسع عالمياً

### قرار 7: Dual Deployment Mode
**القرار:** متغير `DEPLOYMENT_MODE`:
- `saas` - multi-tenant مع billing
- `single_tenant` - شركة واحدة، بدون billing
**ليش:** نفس الكود، نموذجين، صفر تعقيد

### قرار 8: Custom Domain Support
**القرار:** Caddy auto-detects domains وLet's Encrypt SSL تلقائي
**ليش:** صاحب البزنس يربط دومينه الخاص بسهولة

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
│   └── (marketing)/              # nx.sa marketing site
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
- Domain nx.sa: 200 SAR/سنة
- Claude API (BYOK من العملاء): 0
- **المجموع: ~120 SAR/شهر**

### بعد بيع 5 نسخ:
- إيرادات: 200,000+ SAR
- تكاليف ثابتة: 500 SAR/شهر
- **هامش ربح: ~98%**

---

## 10. روابط مهمة

- **Anthropic Docs:** https://docs.claude.com
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Coolify Docs:** https://coolify.io/docs

---

**آخر تحديث:** 27 أبريل 2026
**النسخة:** 0.1.0 NX iWork
**المؤلف:** وليد + Claude Opus
