# 🚀 Deployment Guide - NX iWork

> دليل النشر على Coolify خطوة بخطوة، مع دعم النموذجين (SaaS + Single-Tenant).

---

## 📋 المتطلبات

- ✅ VPS مع Coolify مثبّت (مثل cvo-shop server)
- ✅ Domain (nx.sa, nxiwork.sa, إلخ)
- ✅ حساب GitHub (للـ repository)
- ✅ Anthropic account (لـ API key الخاص بـ test/demo)
- ✅ Resend account (للإيميلات)

---

## 🎯 الخيار 1: نشر SaaS (Multi-Tenant) على nx.sa

### خطوة 1: إعداد PostgreSQL في Coolify

1. افتح Coolify → Resources → PostgreSQL
2. اختر version 16 (مهم - لـ pgvector)
3. اسم: `nx-iwork-db`
4. ⚠️ **مهم:** بعد الإنشاء، شغّل في PostgreSQL terminal:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

### خطوة 2: نشر التطبيق

1. **Resources → New → Public Repository**
2. URL: `https://github.com/your-username/nx-iwork`
3. Branch: `main`
4. Build Pack: **Dockerfile**
5. Port: `3000`

### خطوة 3: Environment Variables

```env
# Database
DATABASE_URL=<من PostgreSQL service URL>

# NextAuth
NEXTAUTH_URL=https://app.nx.sa
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Encryption
ENCRYPTION_KEY=<openssl rand -hex 32>

# Deployment Mode
DEPLOYMENT_MODE=saas

# App
NEXT_PUBLIC_APP_URL=https://app.nx.sa
NEXT_PUBLIC_APP_NAME=NX iWork

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@nx.sa

# Embeddings (Voyage AI - cheap)
VOYAGE_API_KEY=...

# Optional: SaaS billing (later)
# MOYASAR_PUBLIC_KEY=
# MOYASAR_SECRET_KEY=
```

### خطوة 4: Domains

في Coolify → App → Domains:
- `app.nx.sa` (لوحة تحكم أصحاب الأعمال)
- `nx.sa` (الموقع الرئيسي + الصفحات العامة)

✅ Enable **SSL (Let's Encrypt)**

### خطوة 5: Cloudflare DNS

```
Type: A
Name: @
Value: <IP السيرفر>

Type: A  
Name: app
Value: <IP السيرفر>

Type: A
Name: admin
Value: <IP السيرفر>

Type: CNAME
Name: www
Value: nx.sa
```

⚠️ **مهم:** استخدم Cloudflare في mode "DNS only" (سحابة رمادية) لأن Coolify يدير الـ SSL.

### خطوة 6: Deploy + Setup

```bash
# في Coolify Terminal
npx prisma migrate deploy
npx prisma db seed

# إنشاء أول Super Admin
npx tsx scripts/create-admin.ts
```

### خطوة 7: التحقق

- ✅ افتح `https://nx.sa` - الموقع الرئيسي
- ✅ افتح `https://app.nx.sa/login` - تسجيل دخول
- ✅ افتح `https://app.nx.sa/admin` - لوحة الأدمن (بعد تسجيل دخول)

---

## 🎯 الخيار 2: نشر نسخة مرخصة (Single-Tenant) للعميل

### السيناريو
عميل اشترى نسخة بـ 50,000 SAR. يبغى تركيبها على VPS الخاص به.

### خطوة 1: نسخ الكود

```bash
# على VPS العميل
git clone https://github.com/your-username/nx-iwork.git /opt/nx-iwork
cd /opt/nx-iwork
```

### خطوة 2: إعداد Coolify على VPS العميل

نفس الخطوات السابقة، لكن مع تعديل:

```env
DEPLOYMENT_MODE=single_tenant

# يخلي:
# - signup يصير معطّل
# - billing UI مخفي
# - فقط شركة واحدة في DB
```

### خطوة 3: تشغيل setup script

```bash
docker exec -it nx-iwork-app sh

# Setup the customer
npx tsx scripts/setup-customer.ts \
  --company-name="شركة العسل السعودي" \
  --owner-email="ahmed@honey-co.com" \
  --owner-password="<secure-password>" \
  --owner-name="أحمد المالك"
```

هذا يخلق:
- ✅ Company واحدة فقط
- ✅ Owner user واحد
- ✅ Default settings (سعودي)
- ✅ Empty workspace جاهز للتخصيص

### خطوة 4: تخصيص الـ Branding

```bash
# تحديث Branding من قاعدة البيانات (أو من UI)
psql $DATABASE_URL <<EOF
UPDATE business_settings
SET 
  primary_color = '#FFD700',  -- اللون الذهبي للعميل
  show_powered_by = false      -- إخفاء "Powered by NX"
WHERE company_id = '<company-id>';
EOF
```

### خطوة 5: تسليم العميل

اعطه:
- 🔗 URL النسخة (مثلاً https://ai.honey-co.com)
- 👤 بيانات تسجيل دخول
- 📚 دليل الاستخدام (موجود في docs/)
- 🆘 دعم لمدة سنة (حسب العقد)

---

## 🔧 إعداد Caddy للـ Custom Domains

### الفكرة
كل عميل يقدر يربط دومينه الخاص (مثل `mybusiness.com`) ويظهر موقعه العام عليه.

### كيف يشتغل تلقائياً مع Coolify

Coolify يستخدم Caddy تحت الكواليس. لما العميل يضيف دومين من UI:

1. **DB يُحفظ:** `Company.customDomain = "mybusiness.com"`
2. **Background job يضيف للـ Caddy config:**
   ```caddyfile
   mybusiness.com {
     reverse_proxy nx-iwork-app:3000
     tls {
       on_demand
     }
   }
   ```
3. **Caddy يأخذ SSL تلقائياً** من Let's Encrypt
4. **Middleware يتعرف:** عند طلب `mybusiness.com`، يبحث في DB ويوجه للصفحة العامة

### Setup Required في Coolify

أضف environment variable:
```env
CADDY_ON_DEMAND_TLS=true
CADDY_ON_DEMAND_ASK_URL=https://app.nx.sa/api/domains/verify
```

هذا يخلي Caddy يسأل API لو الدومين مسموح يأخذ SSL (يحمي من abuse).

---

## 🔐 الأمان (Production Checklist)

### قبل الإطلاق:
- [ ] SSL/HTTPS مفعّل لكل الدومينات
- [ ] `.env` ليس في Git
- [ ] كل secrets قوية (32+ chars random)
- [ ] `ENCRYPTION_KEY` محفوظ في 3 أماكن آمنة
- [ ] `NEXTAUTH_SECRET` فريد
- [ ] PostgreSQL password قوي
- [ ] Firewall: فقط 80/443/SSH مفتوح
- [ ] SSH بـ key only
- [ ] 2FA على GitHub
- [ ] 2FA على Super Admin
- [ ] Rate limiting شغّال
- [ ] CSP headers مضبوطة
- [ ] Daily backups مفعّلة

### Backups في Coolify:
- Database → Settings → Backups
- ✅ Daily backups
- ✅ Retention: 30 days
- 💾 (اختياري) Backup to S3

---

## 📊 المراقبة (Monitoring)

### في Coolify:
- CPU/RAM/Disk dashboards
- Health checks
- Application logs (real-time)

### إضافات موصى بها:
- **Uptime Kuma** (container منفصل): مراقبة من خارج السيرفر
- **Sentry**: لتتبع الأخطاء (free tier كافي)
- **PostgreSQL Stats**: في Coolify

---

## 🔄 التحديثات (Updates)

### Workflow:
```bash
# في جهاز التطوير
git checkout -b feat/new-feature
# ... تطوير ...
git commit -m "feat: add new feature"
git push origin feat/new-feature

# Merge إلى main عبر PR
# Coolify auto-deploys بعد merge

# لو في DB migration:
docker exec -it nx-iwork-app sh -c "npx prisma migrate deploy"
```

### Auto-Deploy Setup:
1. في Coolify → App → Settings → Webhooks
2. انسخ webhook URL
3. في GitHub → Repository → Settings → Webhooks → Add
4. الصق URL، Events: `push`

---

## 💰 التكاليف الشهرية

### للـ SaaS (nx.sa):
| البند | التكلفة |
|---|---|
| VPS Hostinger | ~100 SAR |
| Domain nx.sa | ~17 SAR/شهر |
| Resend (3K free) | 0 |
| Voyage AI (embeddings) | ~$5-10/شهر |
| **Total** | **~150 SAR/شهر** |

### للنسخة المرخصة:
- التكاليف على العميل (VPS + domain)
- لك: فقط دعم فني (مغطى من رسوم البيع)

---

## 🆘 Troubleshooting

### مشكلة: pgvector extension not found
```sql
-- في PostgreSQL terminal
CREATE EXTENSION vector;
```

### مشكلة: Build فشل (next.config.js)
أضف `output: 'standalone'`:
```js
module.exports = {
  output: 'standalone',
  // ...
}
```

### مشكلة: Custom domain لا يأخذ SSL
- تحقق إن الـ A record يشير لـ IP السيرفر
- انتظر propagation (15 دقيقة - 24 ساعة)
- تحقق من Caddy logs: `docker logs coolify-caddy`

### مشكلة: 502 Bad Gateway
- تحقق إن `PORT=3000` في env
- تحقق إن `HOSTNAME=0.0.0.0`
- أعد deploy

### مشكلة: "BYOK API key invalid"
- تأكد من النص المنسوخ كاملاً
- تحقق إن المفتاح فعلاً يبدأ بـ `sk-ant-`
- جرّب المفتاح مباشرة على https://console.anthropic.com

---

## 🎯 نصائح ذهبية

1. **ابدأ بـ Staging قبل Production**
   - أنشئ subdomain `staging.nx.sa`
   - اختبر كل feature قبل push للـ main

2. **استخدم Branches**
   - `main` = production
   - `develop` = staging
   - `feat/X` = new features

3. **Backups قبل أي migration كبير**
   ```bash
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   ```

4. **Monitor Claude API Usage**
   - راقب الـ usage في Anthropic Console
   - حدد limits لو لازم

5. **Customer Onboarding للنسخ**
   - اعمل video شاشة (5 دقائق) لكل عميل
   - أرسل welcome email مع كل التفاصيل

---

**جاهز للنشر!** 🚀

أي مشكلة:
1. راجع logs أولاً
2. ابحث في الـ docs
3. ارجع لي مع السياق الكامل
