# 🤖 AI Layer — Vertex AI (Managed) — المرجع الكامل

> **الدستور التقني لطبقة الذكاء الاصطناعي.** كل ما يخص اتصال المنصة بـ Google
> Cloud Vertex AI: الإعداد، الاعتماد، النماذج، بنك التوكنز، التحقق، واستكشاف الأخطاء.
> آخر تحقّق حيّ ناجح: مشروع `bznss-one` / `us-central1` (chat + embeddings).

---

## 1. نظرة عامة

المنصة تعمل بوضعين عبر متغيّر `AI_MODE`:

| الوضع | الوصف | الفوترة |
|---|---|---|
| **`managed`** (الافتراضي) | المنصة تتصل بـ **Vertex AI** عبر **Service Account واحد** لكل المستأجرين | بنك توكنز (`Company.tokenBalance`) — المنصة تدفع لقوقل |
| `byok` (اختياري) | كل شركة تجلب مفتاحها الخاص (AI Studio/Anthropic) | العميل يدفع مباشرة — لا بنك توكنز |

**القرار المعتمد:** Vertex AI + Service Account حصرياً. طريقة AI Studio API key
**ملغاة من المسار الافتراضي** (تبقى أكواد BYOK كـ fallback اختياري فقط).

كل سطح الذكاء يمر عبر Vertex:
- **المحادثة + المهام:** SDK الرسمي `@google-cloud/vertexai` (`lib/ai/providers/vertex.ts`)
- **الذاكرة الدلالية (Embeddings):** Vertex predict endpoint، نموذج `gemini-embedding-001` بـ 1536 بُعد (`lib/ai/embeddings.ts`)

---

## 2. المعمارية (أين يقع الكود)

```
lib/ai/
├── index.ts          ← getAiMode() + getProviderForCompany() (managed → Vertex للجميع)
├── types.ts          ← الواجهة المحايدة AiProvider (لا SDK في كود العمل)
├── models.ts         ← خريطة المستويات (fast/balanced/advanced) → معرّف نموذج Vertex
├── embeddings.ts     ← Vertex embeddings (service account + google-auth-library)
└── providers/
    └── vertex.ts     ← محوّل Vertex (chat + tools + استخراج التوكنز)

lib/billing/tokens.ts ← بنك التوكنز: checkTokenBudget() + chargeTokens()
scripts/test-vertex.ts← فحص اتصال حيّ (npm run test:vertex)
```

> الطبقة **محايدة**: `runAgentChat` و`runAgentTask` و`tools` لا تعرف Vertex —
> تتعامل مع `AiProvider` فقط. تبديل/إضافة مزوّد = ملف واحد.

---

## 3. إعداد Google Cloud (مرة واحدة)

1. **فعّل Vertex AI API** على المشروع:
   `Console → APIs & Services → Enable APIs → "Vertex AI API"`.
2. **فعّل الفوترة (Billing)** على المشروع — مطلوب حتى مع رصيد الـ **$300** المجاني.
3. **أنشئ Service Account:**
   `IAM & Admin → Service Accounts → Create` → امنحه دور **`Vertex AI User`**
   (`roles/aiplatform.user`).
4. **أصدر مفتاح JSON:** افتح الحساب → `Keys → Add Key → JSON` → نزّل الملف.
5. (اختياري) تأكّد أن النماذج المطلوبة متاحة في منطقتك عبر `npm run test:vertex`.

---

## 4. الاعتماد (Credentials) — Keyless أولاً

الكود يحلّ المصادقة من `lib/ai/gcp-auth.ts` بأولوية: **متغيّرات inline (إن وُجدت)
← ADC تلقائياً**. لا نشترط وجود مفتاح — يكفي `GCP_PROJECT_ID`.

### ✅ الطريقة المعتمدة: Keyless عبر ADC (بلا أسرار)
لا مفاتيح ولا ملفات في `.env` — فقط:
```bash
AI_MODE=managed
GCP_PROJECT_ID=...        # معرّف مشروعك في GCP
GCP_LOCATION=us-central1
```
والمصادقة تُحلّ تلقائياً:
- **محلياً:** `gcloud auth application-default login` (مرة واحدة).
- **على GCP / VPS:** Service Account مرتبط / Workload Identity.

> آمن وبسيط: لا أسرار تُرفع ولا تُسرّب. تبديل الحساب = إعادة `gcloud auth ...login`
> أو تغيير الهوية المرتبطة بالخادم.

### بديل اختياري: مفاتيح inline (لأجهزة بلا ADC)
إن لم يتوفّر ADC، الصق من ملف الـ JSON (سرّ — `.gitignore` يستثني `.env`/`ai-config/`):
```bash
GCP_CLIENT_EMAIL=...@PROJECT.iam.gserviceaccount.com   # = JSON.client_email
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"  # سطر واحد، \n كما هي، بين ""
```
أو ملف مُركّب: `GOOGLE_APPLICATION_CREDENTIALS=/مسار/مطلق/sa.json` (mount لا copy).

> 🔒 عند أي تسريب لمفتاح **دوّره** من GCP. مع ADC لا حاجة لمفاتيح أصلاً.

---

## 5. متغيّرات البيئة

| المتغيّر | إجباري (managed) | المثال | ملاحظة |
|---|---|---|---|
| `AI_MODE` | نعم | `managed` | `byok` لتعطيل Vertex والرجوع لمفاتيح العملاء |
| `GCP_PROJECT_ID` | نعم | `bznss-one` | معرّف مشروع GCP |
| `GCP_LOCATION` | نعم | `us-central1` | منطقة Vertex |
| `GCP_CLIENT_EMAIL` | نعم* | `…@bznss-one.iam…` | من JSON.client_email (الطريقة المعتمدة) |
| `GCP_PRIVATE_KEY` | نعم* | `"-----BEGIN…\n…"` | من JSON.private_key، سطر واحد بين "" |
| `GOOGLE_APPLICATION_CREDENTIALS` | بديل | مسار الـ JSON | fallback فقط لو لم تُضبط المتغيّرات أعلاه |

> *إجباري واحد من: (`GCP_CLIENT_EMAIL` + `GCP_PRIVATE_KEY`) **أو** `GOOGLE_APPLICATION_CREDENTIALS`.
| `VERTEX_MODEL_FAST` | لا | `gemini-2.5-flash` | تجاوز نموذج المستوى السريع |
| `VERTEX_MODEL_BALANCED` | لا | `gemini-2.5-flash` | المتوازن |
| `VERTEX_MODEL_ADVANCED` | لا | `gemini-2.5-pro` | المتقدّم |
| `VERTEX_EMBEDDINGS_MODEL` | لا | `gemini-embedding-001` | الذاكرة الدلالية |

---

## 6. النماذج (Models)

تتبيّن النماذج المتاحة حسب **المشروع والمنطقة**. على `bznss-one/us-central1`
المتاح المؤكَّد (عبر الفحص الحيّ):

| المستوى (DB enum) | النموذج | الاستخدام |
|---|---|---|
| `HAIKU` (fast) | `gemini-2.5-flash` | خدمة العملاء، الردود السريعة |
| `SONNET` (balanced) | `gemini-2.5-flash` | الافتراضي المتوازن |
| `OPUS` (advanced) | `gemini-2.5-pro` | التحليل والمهام المعقّدة |

> ⚠️ نماذج `gemini-2.0-*` و`gemini-1.5-*` رجعت **404** على هذا المشروع (غير مفعّلة).
> لو غيّرت المشروع/المنطقة، شغّل `npm run test:vertex` وحدّث `VERTEX_MODEL_*`.

### ملاحظة "التفكير" (Thinking tokens)
نماذج Gemini 2.5 تستهلك **توكنز تفكير** لا تظهر في `candidatesTokenCount`. لذلك
محوّلنا يحسب المخرجات من **`totalTokenCount − promptTokenCount`** ليكون خصم بنك
التوكنز **دقيقاً** (لا نخسر تكلفة التفكير). وبميزانية توكنز صغيرة جداً قد يرجع النص
فارغاً (التفكير يستهلك الميزانية) — في الإنتاج (4096) لا مشكلة.

---

## 7. بنك التوكنز (فوترة managed)

- العمود: `Company.tokenBalance` (Integer، منحة تجريبية افتراضية 100,000).
- **قبل كل طلب:** `checkTokenBudget()` — لو `<= 0` يُرفض الطلب ويرجع
  **HTTP 402** (`billing_limit`) برسالة "انتهى الرصيد".
- **بعد كل دور:** `chargeTokens()` — خصم **ذرّي** (`decrement`) بقيمة
  `inputTokens + outputTokens` (شامل التفكير).
- في وضع `byok` الدالتان **no-op** (لا حجب ولا خصم).
- الشحن (top-up) يُربط لاحقاً بـ **Tap.company** (على الخريطة).

---

## 8. التحقق (Smoke Test)

```bash
npm run test:vertex
```
يرسل محادثة + embedding حقيقيين ويتأكد من المصادقة. المخرجات المتوقعة:
```
✅ config
✅ chat — model=gemini-2.5-flash reply="VERTEX_OK" tokens=15+27
✅ embeddings — dims=1536 (expected 1536)
🎉 Vertex AI is reachable and the service account works.
```
يخرج بكود غير صفري عند أي فشل — صالح كـ smoke test بعد كل نشر.

---

## 9. استكشاف الأخطاء

| العرض | السبب المحتمل | الحل |
|---|---|---|
| `404 ... model ... not found` | اسم/إصدار نموذج غير متاح في مشروعك/منطقتك | `npm run test:vertex` لمعرفة المتاح، وحدّث `VERTEX_MODEL_*` |
| `403 / PERMISSION_DENIED` | الدور ناقص أو الـ API غير مفعّل | امنح `Vertex AI User` + فعّل Vertex AI API |
| `billing` / `quota` | الفوترة غير مفعّلة | فعّل Billing (الـ $300 يحتاج فوترة مفعّلة) |
| نص الرد فارغ | توكنز التفكير استهلكت ميزانية صغيرة | زِد `maxTokens` (الإنتاج 4096 يكفي) |
| `vertex_not_configured` | `GCP_PROJECT_ID` أو `GOOGLE_APPLICATION_CREDENTIALS` ناقص | اضبط متغيّرات البيئة وركّب الـ JSON |
| embeddings = null | نفس أسباب الاعتماد أعلاه | تحقّق من الـ service account والمسار |

---

## 10. التبديل بين الوضعين

| من → إلى | الخطوة |
|---|---|
| managed (افتراضي) | اضبط `AI_MODE=managed` + متغيّرات Vertex + ركّب الـ JSON |
| → byok | `AI_MODE=byok` — العملاء يضيفون مفاتيحهم من الإعدادات (لا بنك توكنز) |

---

## 11. ملاحظة الإهلال (Deprecation)

`@google-cloud/vertexai` مُعلَن إهلاله (يُزال **يونيو 2026**) لصالح
[`@google/genai`](https://www.npmjs.com/package/@google/genai). يعمل حالياً بلا
مشاكل. **خطة الصيانة:** الهجرة إلى `@google/genai` (يدعم Vertex عبر
`new GoogleGenAI({ vertexai: true, project, location })`) قبل 2026 — تغيير معزول
في `lib/ai/providers/vertex.ts` فقط بفضل الطبقة المحايدة.

---

**آخر تحديث:** بعد التحقق الحيّ الناجح على `bznss-one`. المرجع المعتمد لطبقة AI.
