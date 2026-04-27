# 🗺️ Roadmap - NX iWork

> **خارطة طريق البناء بالساعات الفعلية** (47-58 ساعة)
> 
> القاعدة الذهبية: لا ننتقل لـ Sprint قبل ما الحالي يخلص ويُختبر.

---

## 📊 الملخص

| Sprint | الموضوع | الوقت | الأهمية |
|---|---|---|---|
| 0 | الأساسيات | 4-5 س | 🔴 critical |
| 1 | البنية الأساسية | 5-6 س | 🔴 critical |
| 2 | Virtual HQ | 6-8 س | 🔴 critical |
| 3 | الذكاء الحقيقي | 8-10 س | 🔴 critical |
| 4 | Tasks & Departments | 5-6 س | 🟡 important |
| 5 | Settings & Branding | 6-8 س | 🟡 important |
| 6 | Public Page | 4-6 س | 🟡 important |
| 7 | Deployment & Custom Domains | 5-6 س | 🔴 critical |
| 8 | Polish & Single-Tenant Mode | 3-4 س | 🟢 nice-to-have |
| **إجمالي** | | **47-58 س** | |

**جلسة عمل = 4-5 ساعات.** تقريباً 10-12 جلسة لإكمال MVP كامل.

---

## 🎯 المعايير الذهبية

### قبل بداية كل Sprint:
- ✅ راجع docs/PROJECT.md
- ✅ راجع التغييرات في CHANGELOG.md
- ✅ تأكد إن الـ Sprint السابق يعمل 100%

### بعد إكمال كل Sprint:
- ✅ كل tasks منجزة ومختبرة
- ✅ Git commits منظّمة بـ conventional commits
- ✅ CHANGELOG.md محدّث
- ✅ Git tag (مثل v0.1.0 بعد Sprint 0)
- ✅ تحقق من وليد إن كل شي يعمل

---

## 🚀 Sprint 0: الأساسيات (4-5 ساعات)

**الهدف:** مشروع Next.js شغال محلياً مع DB، Auth، صفحات أولية.

### المهام:
1. **Next.js 15 setup** (30 دقيقة)
   ```bash
   npx create-next-app@latest nx-iwork --typescript --tailwind --app --src-dir
   ```
2. **Theme & Fonts** (30 دقيقة)
   - Tajawal (default للعربي)
   - Inter (للإنجليزي)
   - Dark theme افتراضي + Light option
   - next-themes للتبديل

3. **shadcn/ui** (30 دقيقة)
   - تثبيت + تكوين
   - الـ primitives الأساسية: Button, Input, Card, Dialog, Tabs, Toast

4. **i18n مع next-intl** (45 دقيقة)
   - إعداد ar/en
   - RTL/LTR support
   - LanguageSwitcher component

5. **Prisma + PostgreSQL** (45 دقيقة)
   - تثبيت Prisma
   - تطبيق schema.prisma كاملاً
   - أول migration: `npx prisma migrate dev --name init`
   - تثبيت extensions (vector, pg_trgm, pgcrypto)

6. **NextAuth v5** (45 دقيقة)
   - تكوين الـ adapter
   - Credentials provider
   - Session strategy
   - Middleware للحماية

7. **Auth Pages** (45 دقيقة)
   - /login
   - /signup
   - /forgot-password (لاحقاً)

8. **Layout & Sidebar** (30 دقيقة)
   - Layout أساسي للـ Dashboard
   - Sidebar مع روابط الميزات
   - Topbar مع user menu + language toggle

### معيار النجاح:
- ✅ `npm run dev` يشتغل
- ✅ تقدر تسجّل حساب جديد
- ✅ تقدر تسجّل دخول
- ✅ تشوف Dashboard فارغ
- ✅ تبديل لغة يشتغل
- ✅ تبديل ثيم يشتغل

### Git Tag: `v0.1.0`

---

## 🏢 Sprint 1: البنية الأساسية (5-6 ساعات)

**الهدف:** Onboarding كامل، إعدادات الشركة، Dashboard أساسي.

### المهام:
1. **Onboarding Wizard** (1.5 ساعة)
   - Step 1: معلومات الشركة الأساسية
   - Step 2: الصناعة + حجم الفريق
   - Step 3: الأهداف الرئيسية
   - Step 4: تأكيد + إنشاء Company

2. **Company Creation Logic** (45 دقيقة)
   - إنشاء Company record
   - إنشاء BusinessSettings افتراضية
   - إنشاء WebsiteConfig افتراضية
   - ربط User بالـ Company

3. **Settings Page** (1.5 ساعة)
   - Tab 1: Localization (لغة، عملة، تاريخ، توقيت)
   - Tab 2: Theme & Branding
   - Tab 3: Company Info
   - Tab 4: API Settings (BYOK)

4. **BYOK API Key Management** (1 ساعة)
   - تشفير قبل الحفظ (AES-256-GCM)
   - validation (test the key مع Anthropic)
   - عرض آخر 4 أحرف فقط

5. **Empty Dashboard** (45 دقيقة)
   - "Welcome back, [name]"
   - Quick actions
   - Empty state with CTA لإضافة موظف

### معيار النجاح:
- ✅ Onboarding يخلق Company كاملة
- ✅ تقدر تغيّر اللغة من Settings
- ✅ تقدر تغيّر العملة والتاريخ
- ✅ تقدر تحفظ BYOK API key (مشفّر)
- ✅ Dashboard يعرض البيانات الصحيحة

### Git Tag: `v0.2.0`

---

## 🤖 Sprint 2: Virtual HQ (6-8 ساعات)

**الهدف:** صفحة عرض الموظفين + إضافة + ملف شخصي بـ 4 تابات.

### المهام:
1. **Agents Grid Page** (1.5 ساعة)
   - عرض شبكي (مثل الصورة المرجعية)
   - Holographic avatar (CSS animations)
   - Status badge (Active/Busy/Idle)
   - Quick stats (tasks, energy %)

2. **Add Agent Modal** (2 ساعات)
   - حقول: name, role, department
   - Persona builder (نص أو wizard)
   - اختيار نموذج Claude
   - اختيار Skills (multi-select)
   - معاينة System Prompt

3. **Agent Profile Page** (2.5 ساعة)
   - Header (avatar, name, role, status)
   - Stats cards (4 metrics)
   - Tab 1: قيد التنفيذ (مع progress bars)
   - Tab 2: منجزة (مع نتائج)
   - Tab 3: فشلت (مع أسباب + retry)
   - Tab 4: Timeline (chronological)

4. **Live Task Board (Kanban)** (1 ساعة)
   - Column 1: قيد الانتظار
   - Column 2: يعمل الآن
   - Column 3: منجز
   - Real-time updates (polling أو websockets)

5. **Departments CRUD basic** (45 دقيقة)
   - إضافة قسم
   - تعديل
   - عرض الموظفين في القسم

### معيار النجاح:
- ✅ تشوف موظفين بصورة احترافية
- ✅ تقدر تضيف موظف بتفاصيل كاملة
- ✅ تفتح ملف موظف وتشوف 4 تابات
- ✅ Live Task Board يحدّث

### Git Tag: `v0.3.0`

---

## 🧠 Sprint 3: الذكاء الحقيقي (8-10 ساعات) ⭐

**هذا أهم Sprint في المشروع.** اقرأ docs/AGENT_SYSTEM.md قبل البدء.

### المهام:
1. **Anthropic SDK + BYOK Integration** (1 ساعة)
   - lib/claude/client.ts
   - decrypt API key per request
   - error handling

2. **Memory System Layer 1: Working Memory** (1 ساعة)
   - استرجاع آخر 20 رسالة
   - تنسيق للـ Claude messages array

3. **Memory System Layer 2: Episodic Memory** (1.5 ساعة)
   - Tasks history queries
   - ChatMessages history
   - استرجاع ذكي بحسب السياق

4. **Memory System Layer 3: Semantic Memory** (2.5 ساعة)
   - تثبيت pgvector
   - Voyage/OpenAI embeddings
   - Vector similarity search
   - Daily consolidation job (cron)

5. **Agent Loop Implementation** (2 ساعة)
   - lib/claude/agent-loop.ts
   - Trigger handler
   - Context builder
   - Think + Tool use loop
   - Memory update

6. **Built-in Tools** (1 ساعة)
   - send_message
   - create_task
   - request_approval
   - save_memory
   - handoff_to_agent

7. **Chat Interface** (1.5 ساعة)
   - Streaming responses
   - Tool calls visualization
   - Approval inline
   - Token counter

### معيار النجاح:
- ✅ تتحدث مع موظف ويرد بشخصيته
- ✅ يستخدم tools (send_message, save_memory)
- ✅ يطلب موافقة لقرارات حساسة
- ✅ يتذكر محادثات سابقة (semantic memory)
- ✅ Streaming يعمل بسلاسة

### Git Tag: `v0.4.0`

---

## ✅ Sprint 4: Tasks & Departments (5-6 ساعات)

**الهدف:** نظام مهام كامل + Departments + Approvals.

### المهام:
1. **Task Assignment Flow** (1.5 ساعة)
   - Modal "Assign Task"
   - اختيار موظف
   - عنوان + وصف + ملاحظات
   - Priority + Due date

2. **Task Execution Background Job** (2 ساعة)
   - Trigger الـ Agent Loop
   - تحديث status (PENDING → WORKING → DONE/FAILED)
   - Progress updates
   - Tasks page

3. **Task Attempts & Retry** (1 ساعة)
   - عند الفشل، خلق TaskAttempt
   - تصنيف الخطأ (errorType)
   - زر retry للـ retryable errors

4. **Approvals Inbox** (1 ساعة)
   - صفحة /approvals
   - قائمة approvals pending
   - تفاصيل + خيارات
   - approve/reject مع notes

5. **Departments Page Enhanced** (30 دقيقة)
   - عرض شجري (org chart)
   - drag & drop (مستقبلاً)

### معيار النجاح:
- ✅ تكلّف موظف بمهمة وتشوفها تتنفّذ
- ✅ لو فشلت، تشوف السبب
- ✅ تقدر تعيد المحاولة
- ✅ Approvals تظهر في inbox

### Git Tag: `v0.5.0`

---

## 🎨 Sprint 5: Settings & Branding (6-8 ساعات)

**الهدف:** كل الإعدادات قابلة للتخصيص + Branding كامل.

### المهام:
1. **Branding Settings** (1.5 ساعة)
   - رفع شعار
   - اختيار ألوان (color picker)
   - معاينة في الـ sidebar
   - حفظ في BusinessSettings

2. **Localization Settings** (1.5 ساعة)
   - اختيار اللغة الرئيسية
   - تفعيل/تعطيل لغات
   - عملة (dropdown مع رموز)
   - تاريخ (formats)
   - عرض الهجري toggle
   - Timezone picker

3. **n8n Integration Setup** (2 ساعة)
   - صفحة Integrations
   - ربط n8n (URL + API key)
   - Tools registration
   - test connection

4. **Tools Management** (1.5 ساعة)
   - عرض الـ tools المتاحة
   - ربط tool بـ agent
   - إعدادات خاصة per agent

5. **Notifications Settings** (45 دقيقة)
   - email notifications toggle
   - desktop notifications
   - per-event preferences

### معيار النجاح:
- ✅ تقدر تغيّر شعار وألوان
- ✅ تقدر تشغّل/تعطّل لغات
- ✅ تقدر تربط n8n
- ✅ تقدر تربط tool بموظف

### Git Tag: `v0.6.0`

---

## 🌐 Sprint 6: Public Page (4-6 ساعات)

**الهدف:** الصفحة العامة لكل بزنس مع chat widget.

### المهام:
1. **Public Routing** (45 دقيقة)
   - app/(public)/[businessSlug]/page.tsx
   - middleware للـ slug detection
   - error page لو slug غير موجود

2. **Hero Section Configurable** (1 ساعة)
   - Image / Slider / Video / Text-only
   - عنوان + subtitle + CTA
   - تخصيص من WebsiteConfig

3. **Services Section** (1 ساعة)
   - عرض services من DB
   - "Request Service" form
   - يخلق Order (type=SERVICE)
   - يخفي القسم لو ما في services

4. **Products Section + Cart** (2 ساعة)
   - عرض products
   - Add to cart
   - Cart drawer
   - Checkout form
   - يخلق Order (type=PRODUCT)
   - يخفي القسم لو ما في products

5. **Chat Widget** (1.5 ساعة)
   - زر floating في الزاوية
   - يفتح drawer مع المحادثة
   - يربط بـ agent محدد (chatAgentId)
   - يخلق PublicConversation
   - Streaming من Claude

6. **Contact + About sections** (30 دقيقة)
   - عرض من WebsiteConfig
   - social links

### معيار النجاح:
- ✅ تفتح nx.sa/{slug} وتشوف الموقع
- ✅ Chat widget يعمل ويحفظ المحادثة
- ✅ تقدر تطلب خدمة وتظهر في Orders
- ✅ تقدر تشتري منتج

### Git Tag: `v0.7.0`

---

## 🚀 Sprint 7: Deployment & Custom Domains (5-6 ساعات)

**الهدف:** نشر على Coolify + دعم Custom Domains.

### المهام:
1. **Dockerfile + docker-compose** (1 ساعة)
   - Test build محلياً
   - Multi-stage optimization

2. **Coolify Setup** (1 ساعة)
   - إنشاء PostgreSQL service
   - إنشاء App service
   - Environment variables
   - First deploy

3. **DNS + Domain** (30 دقيقة)
   - شراء nx.sa
   - DNS setup (A records)
   - app.nx.sa subdomain

4. **Custom Domain UI** (1.5 ساعة)
   - Settings → Domains tab
   - Add domain field
   - Show DNS instructions
   - Verify button

5. **DNS Verification + SSL** (1.5 ساعة)
   - lib/domains/verify.ts
   - polling للتحقق
   - Caddy config update (auto SSL)
   - status indicators

6. **Multi-domain Routing Middleware** (30 دقيقة)
   - middleware.ts يقرأ الـ host
   - يحدد company من custom domain أو slug

### معيار النجاح:
- ✅ المنصة تشتغل على app.nx.sa
- ✅ صاحب بزنس يقدر يربط دومينه
- ✅ SSL تلقائي يعمل
- ✅ الموقع العام يعمل من custom domain

### Git Tag: `v0.8.0`

---

## ✨ Sprint 8: Polish & Single-Tenant Mode (3-4 ساعات)

**الهدف:** تجهيز النموذج المزدوج للبيع.

### المهام:
1. **Deployment Mode Toggle** (1 ساعة)
   - read DEPLOYMENT_MODE env
   - hide billing UI in single_tenant
   - hide signup in single_tenant

2. **Customer Setup Script** (1 ساعة)
   - scripts/setup-customer.ts
   - يأخذ: company name, owner email/password
   - يخلق Company + User + default settings
   - يولّد admin link

3. **Documentation للعملاء** (1 ساعة)
   - README.md للنسخة المباعة
   - دليل الإعداد
   - دليل المستخدم

4. **Demo Data Seed** (30 دقيقة)
   - 3 موظفين أمثلة
   - 5 مهام
   - بيانات معاينة

5. **Polish Pass** (30 دقيقة)
   - fix any UI issues
   - performance optimization
   - error messages

### معيار النجاح:
- ✅ DEPLOYMENT_MODE=single_tenant يخفي الـ billing
- ✅ scripts/setup-customer.ts يعمل بسلاسة
- ✅ Documentation كاملة
- ✅ Demo data يعرض شكل المنصة جاهزة

### Git Tag: `v1.0.0` 🎉

---

## 🎯 الخطة التسويقية (متوازية مع Sprint 4-7)

### أثناء Sprint 4-5 (الأسبوع 4-5):
- [ ] إعداد Pitch Deck
- [ ] قائمة 30 شركة محتملة
- [ ] رسائل WhatsApp شخصية

### أثناء Sprint 6-7 (الأسبوع 6-7):
- [ ] Demo calls (10-15 شركة)
- [ ] Pricing sheet نهائي
- [ ] Sales contracts (نسخة عربية)
- [ ] أول 2-3 صفقات closed

### بعد Sprint 8 (الأسبوع 8):
- [ ] تسليم العملاء الأوائل
- [ ] Case studies
- [ ] إطلاق nx.sa الرسمي

---

## 📈 المعايير النهائية للنجاح

### بعد Sprint 0-3 (الأسبوع 1-2):
- ✅ موظف ذكي شغّال يتحدث مع وليد
- ✅ يقدر يعرضها لأي عميل محتمل (Demo)

### بعد Sprint 4-6 (الأسبوع 3-4):
- ✅ منصة كاملة فيها كل الميزات الأساسية
- ✅ يقدر يبيعها بثقة

### بعد Sprint 7-8 (الأسبوع 5-6):
- ✅ منشورة live على nx.sa
- ✅ تدعم Custom Domains
- ✅ جاهزة للنسخ والبيع
- ✅ أول 2-3 عملاء على المنصة

### الأسبوع 7-8:
- 🎯 5 عملاء × 25-50K = **125-250K SAR** ✨

---

## 🚨 المخاطر والخطط البديلة

### خطر 1: Agent Loop ما يشتغل صح
**الحل:** لدينا fallback mode بدون tools (محادثة عادية فقط)، نطوّر الـ tools تدريجياً.

### خطر 2: Custom Domains معقدة
**الحل:** نطلق بدون Custom Domains، ونضيفها في v1.1

### خطر 3: ما نقدر نبيع 5 نسخ في شهرين
**الحل:** Plan B - نشغّل SaaS مبكراً (Sprint 7) بدل ما ننتظر Sprint 8.

### خطر 4: Claude API يصير غالي للعملاء
**الحل:** BYOK يحل المشكلة (العميل يدفع مباشرة لـ Anthropic).

---

## 🎬 آخر نصيحة

**ابني ميزة → اختبر → commit → انتقل.**

لا تجمع 5 ميزات بدون اختبار. 
لا تخلّي bug غير محلول.
لا تفوّت Git tag.

**كل Sprint = خطوة تقربك من 250K SAR في الجيب.** 💰
