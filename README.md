# NX iWork 🤖

> منصة SaaS لبناء شركات ذاتية التشغيل بالذكاء الاصطناعي. صُممت للسوق السعودي أولاً، عالمية في الجوهر.

[![Status](https://img.shields.io/badge/status-planning-yellow)](.)
[![License](https://img.shields.io/badge/license-proprietary-red)](.)
[![Built with](https://img.shields.io/badge/built%20with-Next.js%2015-black)](.)

---

## 🎯 ما هو NX iWork؟

منصة تتيح لأي صاحب بزنس بناء **شركة كاملة من موظفين ذكاء اصطناعي**:

- 🤖 **موظفين أذكياء حقيقيين** بشخصيات وذاكرة طويلة المدى
- 📊 **مخطط تنظيمي حي** (أقسام، مديرين، موظفين)
- 💬 **محادثات طبيعية** مع كل موظف
- ✅ **مهام تلقائية** تُنفّذ في الخلفية
- 🌐 **موقع عام** للبزنس مع chat widget للزوار
- 🇸🇦 **سياق سعودي** (زاتكا، واتساب، الدارجة)
- 🔌 **n8n integrations** للأدوات الخارجية
- 🔑 **BYOK** (العميل يستخدم مفتاحه الخاص)

---

## 💼 النموذج التجاري المزدوج

### المرحلة 1 (الشهور 1-2): بيع نسخ مرخصة
| الباقة | السعر | المحتوى |
|---|---|---|
| **Starter License** | 25,000 SAR | المنصة + تركيب + تدريب |
| **Pro License** | 50,000 SAR | + تخصيص ألوان وشعار |
| **Enterprise** | 100,000 SAR | + ميزات مخصصة + دعم سنوي |

**الهدف:** 200,000+ SAR في أول شهرين.

### المرحلة 2 (الشهر 3+): إطلاق SaaS
| الباقة | السعر | الميزات |
|---|---|---|
| **Free** | 0 | موظف واحد، محدودة |
| **Starter** | 99 SAR/شهر | 3 موظفين |
| **Growth** | 299 SAR/شهر | 10 موظفين، Custom domain |
| **Scale** | 799 SAR/شهر | غير محدود + API |

---

## 🚀 كيف تبدأ؟

### للقراءة:
1. **[START_HERE.md](./START_HERE.md)** ⭐ ابدأ هنا
2. **[docs/PROJECT.md](./docs/PROJECT.md)** - دستور المشروع
3. **[docs/AGENT_SYSTEM.md](./docs/AGENT_SYSTEM.md)** - قلب المنصة التقني
4. **[docs/ROADMAP.md](./docs/ROADMAP.md)** - خارطة الطريق
5. **[docs/DATABASE.md](./docs/DATABASE.md)** - مخطط البيانات
6. **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - دليل النشر

### للبناء (مع Claude Code):
```bash
# 1. ثبّت Claude Code
npm install -g @anthropic-ai/claude-code

# 2. ادخل المجلد
cd nx-iwork

# 3. شغّل Claude Code
claude

# 4. قل له:
# "اقرأ START_HERE.md و docs/* وأعطني خطة Sprint 0"
```

---

## 🏗️ Tech Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Tajawal + Inter fonts
- next-intl للترجمة

### Backend
- Next.js API Routes
- Prisma ORM
- PostgreSQL 16 + pgvector
- NextAuth.js v5

### AI
- Anthropic Claude (BYOK)
- Voyage AI (embeddings)
- 3-Layer Memory System

### DevOps
- Docker + Coolify
- Caddy (auto SSL)
- VPS (Hostinger/etc.)

---

## 📂 هيكل المشروع

```
nx-iwork/
├── START_HERE.md              ← ابدأ هنا!
├── README.md                  
├── CHANGELOG.md
│
├── docs/                      ← كل الوثائق
│   ├── PROJECT.md
│   ├── DATABASE.md
│   ├── AGENT_SYSTEM.md       ⭐ القلب التقني
│   ├── ROADMAP.md
│   └── DEPLOYMENT.md
│
└── starter-files/             ← ملفات جاهزة للنسخ
    ├── package.json
    ├── Dockerfile
    ├── .env.example
    ├── .gitignore
    └── prisma/
        └── schema.prisma
```

---

## 🔒 الأمن

- ✅ بيانات مشفّرة at-rest
- ✅ AES-256-GCM للـ BYOK API keys
- ✅ SSL إجباري
- ✅ 2FA للأدمن
- ✅ Multi-tenant isolation كامل
- ✅ Audit logs لكل عملية
- ✅ Rate limiting

---

## 📊 الأهداف

### Phase 1 (شهرين):
- 🎯 200,000+ SAR من بيع النسخ
- 🎯 5 عملاء راضين
- 🎯 منصة جاهزة للإطلاق العام

### Phase 2 (6 أشهر):
- 🎯 100+ مشترك SaaS
- 🎯 30,000 SAR MRR
- 🎯 إطلاق Skills Marketplace

### Phase 3 (سنة):
- 🎯 500+ مشترك
- 🎯 150,000 SAR MRR
- 🎯 توسع لدول الخليج

---

## 👥 الفريق

- **المؤسس والمالك:** وليد
- **المخطط الاستراتيجي:** Claude Opus 4.7 (Anthropic)
- **المطوّر التقني:** Claude Code (Anthropic)

---

## 📞 التواصل

- **البريد:** waleed@nx.sa
- **الموقع:** https://nx.sa (قيد الإنشاء)

---

## 📄 الترخيص

© 2026 NX iWork. جميع الحقوق محفوظة.

لا يُسمح بالنسخ أو التوزيع أو الاستخدام التجاري دون إذن صريح من المالك.

---

**صُمّم بحبٍ في 🇸🇦 السعودية**
