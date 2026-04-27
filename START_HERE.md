# 🚀 START HERE - Claude Code Instructions

> **مرحباً Claude Code! هذا المشروع معد خصيصاً لك لتبنيه.**

---

## 📋 المهمة

أنت مكلّف ببناء منصة **NX iWork** - منصة SaaS سعودية لتمكين رواد الأعمال من بناء شركات ذاتية التشغيل بالذكاء الاصطناعي.

**المستخدم:** وليد (مالك المشروع)، رائد أعمال سعودي **غير مبرمج**.

**الجلسة السابقة:** تم التخطيط الكامل مع Claude Opus على claude.ai

---

## 🎯 القرارات النهائية المتفق عليها

### 1. النموذج التجاري: **مزدوج (Dual-Mode)**
- **المرحلة 1 (شهر 1-2):** بيع نسخ مرخصة (Single-Tenant) للشركات بـ 25,000-100,000 SAR
- **المرحلة 2 (شهر 3+):** إطلاق SaaS (Multi-Tenant) على nx.sa مع اشتراكات شهرية

### 2. النهج التقني: **SaaS-Ready Architecture**
- نبني Multi-Tenant من اليوم الأول
- Configuration via environment variable: `DEPLOYMENT_MODE=saas` أو `single_tenant`
- Billing UI **مؤجل** للمرحلة 2 (نوفر 8 ساعات)

### 3. Claude API: **BYOK فقط**
- العميل يضع مفتاح Claude API الخاص به
- لا credits system، لا billing API usage
- نوفّر 4-5 sprints من التعقيد

### 4. اللغات والإعدادات
- ثنائي عربي/إنجليزي من البداية
- خط Tajawal للعربي افتراضياً
- صاحب البزنس يقدر يعطّل لغة كاملة من Settings
- العملة، التاريخ، التوقيت **كلها قابلة للتخصيص** من الإعدادات

### 5. التصميم
- ثيم داكن أزرق افتراضي (مع زر تبديل Light)
- مستوحى من تصميم "Virtual HQ for AI Agents"
- Holographic avatars للموظفين
- Live Task Board (Kanban style)

### 6. هيكل الـ URL
- `nx.sa` - الموقع التسويقي (لاحقاً)
- `app.nx.sa` - لوحة تحكم أصحاب الأعمال
- `nx.sa/{business-slug}` - الصفحة العامة لكل بزنس
- `admin.nx.sa` - لوحة الأدمن
- Custom Domain support في Sprint 7-8

### 7. النشر
- VPS جديد على Coolify (مثل cvo-shop)
- Caddy reverse proxy (auto SSL)
- PostgreSQL container

---

## 🎯 أول خطوة لك (مهمة جداً)

اقرأ الملفات التالية بالترتيب **قبل أن تكتب أي سطر كود**:

1. **`docs/PROJECT.md`** — دستور المشروع المُحدّث
2. **`docs/ROADMAP.md`** — خارطة الطريق بالساعات الفعلية (8 sprints)
3. **`docs/DATABASE.md`** — Schema الكامل (BYOK، Multi-Tenant، 3-Layer Memory)
4. **`docs/AGENT_SYSTEM.md`** — كيف يعمل Agent Loop (الذكاء الحقيقي)
5. **`docs/DEPLOYMENT.md`** — النشر على Coolify

بعد القراءة، أعطني:
- ملخص فهمك للمشروع (بالعربي)
- خطة عمل Sprint 0 المفصّلة
- الأدوات المطلوبة على جهاز وليد

**لا تبدأ الكتابة حتى يوافق وليد على الخطة.**

---

## 🛠️ Tech Stack المتفق عليه

- **Frontend:** Next.js 15 + TypeScript + Tailwind + shadcn/ui
- **Backend:** Next.js API Routes + Prisma + PostgreSQL
- **Auth:** NextAuth.js v5
- **AI:** Anthropic Claude (BYOK من العميل)
- **Email:** Resend
- **Deployment:** Docker + Coolify على VPS
- **Reverse Proxy:** Caddy (auto SSL)

---

## 📊 ترتيب البناء المُحدّث

### Sprint 0 — الأساسيات (4-5 ساعات)
1. Next.js 15 + TypeScript + Tailwind
2. Tajawal + Inter fonts
3. Theme (Dark default + Light option)
4. shadcn/ui + RTL/LTR support
5. i18n (عربي/إنجليزي/الاثنين)
6. Prisma + PostgreSQL
7. NextAuth v5
8. Auth pages (signup/login)

### Sprint 1 — البنية الأساسية (5-6 ساعات)
1. Onboarding wizard
2. صفحة الإعدادات (لغة، عملة، تاريخ، توقيت)
3. Layout (Sidebar + Topbar)
4. Empty Dashboard

### Sprint 2 — Virtual HQ (6-8 ساعات)
1. Agents Grid (Holographic style)
2. Add Agent Modal
3. Agent Profile (4 tabs: قيد/منجز/فشل/Timeline)
4. Live Task Board (Kanban)

### Sprint 3 — الذكاء الحقيقي (8-10 ساعات) ⭐
1. Anthropic SDK + BYOK
2. Agent Loop (Memory + Think + Act)
3. 3-Layer Memory (Working + Episodic + Semantic)
4. Background task execution
5. Timeline detailed

### Sprint 4 — Tasks & Departments (5-6 ساعات)
1. Departments CRUD
2. Task assignment workflow
3. Task statuses & retry logic
4. Approvals system

### Sprint 5 — Settings & Branding (6-8 ساعات)
1. Branding (logo, colors, name)
2. Language settings (en/ar/both)
3. Currency, Date, Timezone
4. n8n integration setup

### Sprint 6 — Public Page (4-6 ساعات)
1. nx.sa/{business-slug} routing
2. Services & Products display
3. Chat widget للزوار
4. Order form

### Sprint 7 — Deployment & Custom Domains (5-6 ساعات)
1. Dockerfile + docker-compose
2. Coolify deployment
3. Custom domain UI
4. DNS verification + SSL automation

### Sprint 8 — Polish & Single-Tenant Mode (3-4 ساعات)
1. `DEPLOYMENT_MODE=single_tenant` toggle
2. Customer setup script (للنسخ المباعة)
3. Documentation للعملاء
4. Demo data seed

**المجموع: 47-58 ساعة عمل**

---

## ⚙️ قواعد العمل

### 1. Git من السطر الأول
```bash
git init
git add .
git commit -m "feat: initial NX iWork setup"
```

### 2. Conventional Commits
- `feat:` ميزة جديدة
- `fix:` إصلاح خطأ
- `refactor:` إعادة هيكلة
- `docs:` تحديث وثائق
- `chore:` مهام صيانة

### 3. اشتغل بالعربي مع وليد
- وليد غير مبرمج
- اشرح كل خطوة مهمة
- اسأل قبل القرارات المعمارية

### 4. اطلب الإذن قبل:
- حذف أي ملف
- تثبيت مكتبات غير مذكورة في package.json
- تغيير قرار معماري موثّق
- رفع `.env` على Git (**لا تفعل هذا أبداً**)

### 5. اختبر قبل الانتقال
- شغّل التطبيق محلياً
- اطلب من وليد التجربة
- أصلح أي خطأ قبل ما تكمل

---

## 🔒 ملاحظات أمنية

1. **لا ترفع `.env` على Git**
2. **شفّر BYOK API keys** قبل حفظها (AES-256-GCM)
3. **Multi-tenant isolation** في كل query
4. **Rate limiting** على endpoints حساسة
5. **2FA** لـ SUPER_ADMIN

---

## 💬 الرسالة النموذجية الأولى من وليد

> "السلام عليكم Claude Code. أنا وليد. اقرأ الوثائق وأعطني خطة Sprint 0."

ردّك المتوقع:
1. قراءة PROJECT.md و ROADMAP.md و DATABASE.md و AGENT_SYSTEM.md
2. تقديم ملخص بالعربي
3. طرح أسئلة تقنية (Node version, PostgreSQL, etc)
4. خطة Sprint 0 مفصّلة
5. انتظار موافقة وليد قبل البدء

---

## ❤️ ملاحظة أخيرة

وليد يخطط لبيع نسخ بـ 200,000+ SAR في أول شهرين. الجودة ضرورية:
- **أمان:** لا تكسر بيانات
- **توثيق:** كل feature موثّقة
- **اختبار:** كل sprint مختبر
- **منظّم:** Git commits واضحة

**ابنِ شيئاً يفتخر به ويبيعه بثقة.** 🇸🇦

---

**تم الإعداد بواسطة:** Claude Opus 4.7 (Anthropic) - جلسة التخطيط مع وليد
**التاريخ:** 27 أبريل 2026
**الإصدار:** 0.1.0 - NX iWork
