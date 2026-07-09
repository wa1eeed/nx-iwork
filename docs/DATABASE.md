# Database Schema - NX iWork

> **Prisma Schema الكامل للنموذج المزدوج (Dual-Mode SaaS + Single-Tenant)**

---

## 🆕 تحديثات v0.2 (CRM + مرونة الأنشطة + الأدوات)

migration: `20260619130000_crm_flexible_tasks`

- **`Customer`** (CRM): سجل العميل/Lead مع `LeadStatus` (NEW → INTERESTED →
  NEGOTIATING → WON/LOST)، يُسند لوكيل (`assignedAgentId`)، ويرتبط بالمهام والطلبات.
- **`customFields` (JSONB)** على `Service` و`Product` و`Customer` و`Task` — أي نشاط
  يضيف خصائصه دون تعديل schema.
- **`Task` موحّد:** `TaskKind` (AGENT_TASK / APPOINTMENT / REMINDER) + `startAt`/`endAt`
  للتقويم + `customerId`. صار `agentId` اختيارياً (مواعيد/تذكيرات بلا وكيل، onDelete: SetNull).
- **`Order.customerId`** يربط الطلب بسجل CRM دائم (اختياري).
- **`CompanyApiSettings.byokProvider`** يُستخدم فعلياً الآن لاختيار المحرك (Gemini/Claude).

> الطبقة المحايدة في `lib/ai/` وأدوات الوكيل في `lib/agent/tools.ts` تقرأ/تكتب على هذه الجداول.

---

## 🎯 التغييرات عن المشروع الأصلي

### نموذج الذكاء الحالي: **managed-أولاً** (Vertex + بنك توكنز)، BYOK اختياري
- ✅ `Company.tokenBalance` — **بنك توكنز managed** (المنصة تدفع لجوجل وتُحاسِب
  بالاستهلاك الحقيقي). الافتراضي 5,000,000.
- ✅ `Plan` / `Subscription` / `Invoice` **فعّالة** (اشتراكات + فواتير، دفع من
  المحفظة أو Tap).
- ✅ BYOK **اختياري**: `CompanyApiSettings.byokProvider` + مفتاح مشفّر AES-256-GCM.
- ⚠️ **تحديث:** سابقاً كان BYOK-أولاً بلا credits/billing؛ تحوّلنا إلى **managed +
  بنك توكنز** (انظر `PROJECT.md` قرار 2 و`AI_VERTEX.md`).

### أضفنا (للذكاء الحقيقي):
- ✅ `AgentMemory` - الذاكرة طويلة المدى (vector)
- ✅ `TaskAttempt` - محاولات تنفيذ المهمة
- ✅ `Approval` - قرارات تحتاج موافقة
- ✅ `AgentSchedule` - جدولة المهام
- ✅ `Tool` - الأدوات التنفيذية
- ✅ `AgentTool` - ربط الموظفين بالأدوات
- ✅ `Service` - الخدمات (للفرونت إند)
- ✅ `Product` - المنتجات
- ✅ `Order` - الطلبات
- ✅ `WebsiteConfig` - إعدادات الموقع العام
- ✅ `PublicConversation` - محادثات الزوار
- ✅ `BusinessSettings` - إعدادات الشركة (لغة، عملة، تاريخ)

---

## 📋 PostgreSQL Setup

### Required Extensions

```sql
-- For long-term semantic memory
CREATE EXTENSION IF NOT EXISTS vector;

-- For better text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- For UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 📐 Prisma Schema (الكامل)

موجود في `prisma/schema.prisma`. النسخة هنا مرجعية للقراءة.

### الأقسام:
1. Users & Auth
2. Company (Tenant)
3. Departments & Agents
4. Memory System (3 layers)
5. Tasks & Approvals
6. Skills & Tools
7. Schedules
8. Public Frontend (Services/Products/Orders)
9. Settings (Configurable)
10. Subscriptions (للـ SaaS phase - معطّل في single-tenant)
11. Audit Logs
12. Notifications

---

## 🔑 Important Design Notes

### 1. Multi-Tenancy via `companyId`

كل جدول له `companyId` (إلا User و Plan). كل query لازم يفلتر:

```typescript
// ❌ خطأ
const agents = await prisma.agent.findMany();

// ✅ صح
const agents = await prisma.agent.findMany({
  where: { companyId: session.user.companyId }
});
```

استخدم Prisma middleware لفرض هذا تلقائياً.

### 2. BYOK Encryption

`CompanyApiSettings.byokApiKey` مشفّر AES-256-GCM:

```typescript
// قبل الحفظ
const encrypted = encrypt(apiKey, process.env.ENCRYPTION_KEY);

// قبل الاستخدام
const decrypted = decrypt(stored, process.env.ENCRYPTION_KEY);
```

### 3. Multi-tenant SaaS (النموذج الحيّ)

المنصة الحيّة **SaaS متعدّد المستأجرين**: عزل بيانات لكل شركة عبر `companyId` (+ RLS)،
واشتراكات عبر `Subscription`/`Invoice`/`Plan`. (وضع single-tenant لم يعد مُنفَّذاً في الكود.)

### 4. Vector Memory

`AgentMemory.embedding` نوعه `vector(1536)` — يُملأ من Google Gemini
`gemini-embedding-001` بـ `outputDimensionality: 1536` (`lib/ai/embeddings.ts`).

```sql
CREATE INDEX agent_memory_embedding_idx 
ON agent_memories 
USING ivfflat (embedding vector_cosine_ops);
```

---

## 📊 Schema Highlights

### User & Roles

```prisma
enum UserRole {
  SUPER_ADMIN      // وليد (مالك المنصة)
  BUSINESS_OWNER   // صاحب الشركة المشتركة
  BUSINESS_MEMBER  // موظف بشري في شركة
}
```

### Company (Tenant)

```prisma
model Company {
  id             String        @id @default(cuid())
  name           String
  nameEn         String?
  slug           String        @unique  // للـ URLs العامة
  logo           String?
  status         CompanyStatus @default(TRIAL)
  
  customDomain   String?       @unique  // إذا ربط دومينه الخاص
  customDomainVerified Boolean @default(false)

  // Managed AI billing
  plan           PlanTier      @default(STARTER)
  tokenBalance   Int           @default(5000000) // prepaid AI token bank

  // Guardrails (owner governance — see docs/AGENT_SYSTEM.md → Guardrails & Autonomy)
  automationEnabled           Boolean @default(true)  // master scheduler switch
  requireApprovalForSensitive Boolean @default(true)
  requireMessageReview        Boolean @default(false)
  spendApprovalCapEnabled     Boolean @default(true)
  spendApprovalCapSar         Int     @default(500)

  // Configurable Settings
  settings       BusinessSettings?
  
  users          User[]
  agents         Agent[]
  // ... etc
}
```

### Configurable Settings

```prisma
model BusinessSettings {
  id              String   @id @default(cuid())
  companyId       String   @unique
  
  // Language
  primaryLanguage String   @default("ar")        // ar, en
  showLanguageToggle Boolean @default(true)      // إظهار زر التبديل؟
  enabledLanguages String[] @default(["ar","en"]) // اللغات المفعّلة
  
  // Currency
  currency        String   @default("SAR")       // SAR, USD, AED, EUR, GBP
  currencySymbol  String   @default("ر.س")
  
  // Date & Time
  dateFormat      String   @default("DD/MM/YYYY")
  showHijriDate   Boolean  @default(true)
  timezone        String   @default("Asia/Riyadh")
  
  // Theme
  themeMode       String   @default("dark")      // dark, light, system
  primaryColor    String   @default("#06b6d4")   // cyan
  accentColor     String   @default("#8b5cf6")   // purple
  
  // Branding
  showPoweredBy   Boolean  @default(true)        // false في النسخ المرخصة
}
```

### Agent (الموظف الذكي)

```prisma
model Agent {
  id             String      @id @default(cuid())
  companyId      String
  name           String
  nameEn         String?
  avatar         String?     // URL أو base64
  initial        String      // حرف للـ fallback
  
  role           String      // المنصب
  persona        String      @db.Text  // الشخصية الكاملة
  systemPrompt   String?     @db.Text  // مولّد تلقائياً
  
  departmentId   String
  parentId       String?     // المدير المباشر
  
  // AI Config
  model          ClaudeModel @default(SONNET)
  temperature    Float       @default(0.7)
  maxTokens      Int         @default(4096)
  
  // Skills & Tools
  skills         AgentSkill[]
  tools          AgentTool[]
  
  // Memory
  memories       AgentMemory[]
  
  // Schedules
  schedules      AgentSchedule[]
  
  // Tasks & Conversations
  tasks          Task[]
  taskAttempts   TaskAttempt[]
  approvals      Approval[]
  chatMessages   ChatMessage[]
  publicConversations PublicConversation[]
  
  // Stats
  status         AgentStatus @default(ONLINE)
  tasksCompleted Int         @default(0)
  tasksFailed    Int         @default(0)
  totalTokensUsed Int        @default(0)
  
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  archivedAt     DateTime?
}
```

### 3-Layer Memory

```prisma
// Layer 1: Working Memory = ChatMessages (آخر 20)
// Layer 2: Episodic Memory = Tasks + ChatMessages (كلها)
// Layer 3: Semantic Memory = AgentMemory (vector)

model AgentMemory {
  id          String   @id @default(cuid())
  agentId     String
  agent       Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  
  summary     String   @db.Text  // الملخص النصي
  embedding   Unsupported("vector(1536)")  // pgvector
  
  importance  Int      @default(5)  // 1-10
  category    String?  // 'customer', 'product', 'decision', etc.
  
  metadata    Json?    // {sourceTaskId, customerId, etc.}
  
  createdAt   DateTime @default(now())
  expiresAt   DateTime?  // optional auto-expiry
  
  @@index([agentId])
}
```

### Tasks & Attempts

```prisma
model Task {
  id            String       @id @default(cuid())
  companyId     String
  agentId       String
  
  title         String
  description   String       @db.Text
  
  status        TaskStatus   @default(PENDING)
  priority      TaskPriority @default(MEDIUM)
  progress      Int          @default(0)
  
  // Wake trigger source
  triggerType   String       // USER_MESSAGE, SCHEDULE, WEBHOOK, etc.
  triggerSource Json?        // {type, id, payload}
  
  // Execution
  startedAt     DateTime?
  dueAt         DateTime?
  completedAt   DateTime?
  result        String?      @db.Text
  
  // For chained tasks
  parentTaskId  String?
  parentTask    Task?        @relation("TaskHierarchy", fields: [parentTaskId], references: [id])
  subtasks      Task[]       @relation("TaskHierarchy")
  
  // Stats
  tokensUsed    Int          @default(0)
  attempts      TaskAttempt[]
  approvals     Approval[]
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model TaskAttempt {
  id            String        @id @default(cuid())
  taskId        String
  task          Task          @relation(fields: [taskId], references: [id], onDelete: Cascade)
  agentId       String
  agent         Agent         @relation(fields: [agentId], references: [id])
  
  attemptNumber Int
  status        AttemptStatus // SUCCEEDED, FAILED, CANCELLED
  
  errorReason   String?       @db.Text
  errorType     String?       // 'API_LIMIT', 'PERMISSION', 'EXTERNAL_API_ERROR', etc.
  retryable     Boolean       @default(true)
  
  startedAt     DateTime
  endedAt       DateTime?
  
  tokensUsed    Int           @default(0)
  metadata      Json?         // tool calls, decisions, etc.
  
  createdAt     DateTime      @default(now())
}

enum TaskStatus {
  PENDING            // لم يبدأ
  WORKING            // يشتغل عليه
  PENDING_APPROVAL   // ينتظر موافقة
  PENDING_REVIEW     // ينتظر مراجعة
  BLOCKED            // متوقف
  DONE               // منجز
  FAILED             // فشل (بعد محاولات)
  CANCELLED          // ملغى
}

enum AttemptStatus {
  RUNNING
  SUCCEEDED
  FAILED
  CANCELLED
}
```

### Approvals (Inbox للقرارات)

```prisma
model Approval {
  id           String         @id @default(cuid())
  companyId    String
  agentId      String
  agent        Agent          @relation(fields: [agentId], references: [id])
  taskId       String?
  task         Task?          @relation(fields: [taskId], references: [id])
  
  decision     String         @db.Text  // ما يطلب الموافقة عليه
  options      Json           // الخيارات المتاحة
  context      String?        @db.Text  // السياق
  
  status       ApprovalStatus @default(PENDING)
  resolution   String?        // الخيار المختار
  resolvedById String?        // من وافق
  resolvedAt   DateTime?
  notes        String?        @db.Text  // ملاحظات الإنسان
  
  expiresAt    DateTime?      // ينتهي تلقائياً
  
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}
```

### Skills & Tools

```prisma
model Skill {
  id             String       @id @default(cuid())
  key            String       @unique
  name           String
  nameEn         String
  description    String       @db.Text
  category       String?
  
  promptTemplate String?      @db.Text  // يحقن في system prompt
  
  isSaudi        Boolean      @default(false)
  isPremium      Boolean      @default(false)
  isActive       Boolean      @default(true)
  
  agents         AgentSkill[]
}

model AgentSkill {
  agentId   String
  skillId   String
  agent     Agent  @relation(fields: [agentId], references: [id], onDelete: Cascade)
  skill     Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)
  addedAt   DateTime @default(now())
  
  @@id([agentId, skillId])
}

// NOTE: Tool / AgentTool / ToolType are SCAFFOLDING and not wired at runtime.
// The live agent tools are the INTERNAL function-calling tools gated by
// getToolsForAgent (module ∩ Agent.permissions) in lib/agent/tools.ts. The
// N8N_WORKFLOW enum value is a legacy scaffold; n8n is not used in the codebase.
model Tool {
  id          String      @id @default(cuid())
  key         String      @unique
  name        String
  description String      @db.Text
  
  type        ToolType    // CLAUDE_TOOL, N8N_WORKFLOW, INTERNAL_API
  schema      Json        // JSON schema للـ inputs
  
  // For external webhook tools (scaffold; unused)
  webhookUrl  String?
  
  // For internal APIs
  handler     String?     // اسم الدالة الداخلية
  
  isActive    Boolean     @default(true)
  
  agents      AgentTool[]
}

model AgentTool {
  agentId   String
  toolId    String
  agent     Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)
  tool      Tool  @relation(fields: [toolId], references: [id], onDelete: Cascade)
  
  config    Json?  // إعدادات خاصة (مثل API key للـ tool)
  
  @@id([agentId, toolId])
}

enum ToolType {
  CLAUDE_TOOL      // built-in like send_message
  N8N_WORKFLOW     // external n8n
  INTERNAL_API     // internal NX iWork API
  CUSTOM_HTTP      // custom webhook
}
```

### Schedules (الجدولة)

```prisma
model AgentSchedule {
  id          String         @id @default(cuid())
  agentId     String
  agent       Agent          @relation(fields: [agentId], references: [id], onDelete: Cascade)
  companyId   String
  
  name        String         // "Morning Standup"
  description String?
  
  // Cron expression
  cronExpression String      // "0 8 * * *" = 8 AM daily
  timezone    String         @default("Asia/Riyadh")
  
  // What to do
  taskTemplate String         @db.Text  // الـ prompt اللي يُرسل
  
  // State
  isActive    Boolean        @default(true)
  lastRunAt   DateTime?
  nextRunAt   DateTime?
  
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
}
```

### Public Frontend (Services, Products, Orders)

```prisma
model Service {
  id          String   @id @default(cuid())
  companyId   String
  
  title       String
  titleEn     String?
  description String   @db.Text
  descriptionEn String? @db.Text
  
  icon        String?  // lucide icon name
  image       String?  // optional image
  
  price       Decimal? @db.Decimal(10, 2)  // اختياري (POA possible)
  priceLabel  String?  // "ابتداءً من" أو "حسب الطلب"
  
  ctaText     String   @default("اطلب الخدمة")
  
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  
  orders      Order[]  @relation("ServiceOrders")
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Product {
  id          String   @id @default(cuid())
  companyId   String
  
  title       String
  titleEn     String?
  description String   @db.Text
  
  images      String[] // array of URLs
  
  price       Decimal  @db.Decimal(10, 2)
  comparePrice Decimal? @db.Decimal(10, 2)  // السعر قبل الخصم
  
  sku         String?
  stock       Int      @default(-1)  // -1 = unlimited
  
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  
  orderItems  OrderItem[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Order {
  id           String       @id @default(cuid())
  companyId    String
  
  orderNumber  String       @unique  // ORD-2026-0001
  
  type         OrderType    // SERVICE or PRODUCT
  
  // Customer info
  customerName  String
  customerEmail String?
  customerPhone String?
  customerNotes String?     @db.Text
  
  // For service orders
  serviceId    String?
  service      Service?     @relation("ServiceOrders", fields: [serviceId], references: [id])
  
  // For product orders
  items        OrderItem[]
  
  // Totals
  subtotal     Decimal      @db.Decimal(10, 2) @default(0)
  vat          Decimal      @db.Decimal(10, 2) @default(0)
  total        Decimal      @db.Decimal(10, 2) @default(0)
  currency     String       @default("SAR")
  
  status       OrderStatus  @default(NEW)
  paymentStatus PaymentStatus @default(PENDING)
  
  // Linked agent (if order came through chat)
  agentId      String?
  
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id])
  
  quantity  Int
  unitPrice Decimal @db.Decimal(10, 2)
  total     Decimal @db.Decimal(10, 2)
}

enum OrderType {
  SERVICE
  PRODUCT
}

enum OrderStatus {
  NEW
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  REFUNDED
  FAILED
}
```

### Website Config (إعدادات الفرونت العام)

```prisma
model WebsiteConfig {
  id          String   @id @default(cuid())
  companyId   String   @unique
  
  // Hero
  heroType    HeroType @default(IMAGE)  // IMAGE, SLIDER, VIDEO
  heroTitle   String?
  heroTitleEn String?
  heroSubtitle String? @db.Text
  heroSubtitleEn String? @db.Text
  heroCTA     String?  // "اطلب الآن"
  heroImages  String[] // array of URLs (for slider)
  heroVideo   String?  // URL
  
  // About section
  aboutTitle  String?
  aboutContent String? @db.Text
  
  // Contact
  whatsapp    String?
  phone       String?
  email       String?
  address     String?
  
  // Social
  instagram   String?
  twitter     String?
  tiktok      String?
  linkedin    String?
  
  // SEO
  metaTitle    String?
  metaDescription String?
  
  // Chat Widget
  chatEnabled       Boolean @default(true)
  chatAgentId       String?  // الموظف اللي يرد على الزوار
  chatPosition      String   @default("bottom-right")
  chatGreeting      String?
  chatGreetingEn    String?
  
  updatedAt   DateTime @updatedAt
}

enum HeroType {
  IMAGE
  SLIDER
  VIDEO
  TEXT_ONLY
}
```

### Public Conversations (محادثات الزوار)

```prisma
model PublicConversation {
  id          String    @id @default(cuid())
  companyId   String
  agentId     String
  agent       Agent     @relation(fields: [agentId], references: [id])
  
  // Visitor info (no signup required)
  visitorId   String    // generated cookie
  visitorName String?
  visitorEmail String?
  visitorPhone String?
  
  // Session info
  sessionStarted DateTime @default(now())
  lastMessageAt  DateTime @default(now())
  ended       Boolean    @default(false)
  
  // Messages
  messages    PublicMessage[]
  
  // Outcome
  resultedInOrder Boolean @default(false)
  orderId     String?
  
  // Analytics
  pageUrl     String?
  referrer    String?
  userAgent   String?
  ipAddress   String?
  
  @@index([visitorId])
  @@index([companyId, sessionStarted])
}

model PublicMessage {
  id              String              @id @default(cuid())
  conversationId  String
  conversation    PublicConversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  role            MessageRole
  content         String              @db.Text
  
  tokensUsed      Int                 @default(0)
  
  createdAt       DateTime            @default(now())
}

enum MessageRole {
  USER
  AGENT
  SYSTEM
}
```

### CompanyApiSettings (BYOK)

```prisma
model CompanyApiSettings {
  id            String      @id @default(cuid())
  companyId     String      @unique
  
  // BYOK
  byokApiKey    String?     // ENCRYPTED with AES-256-GCM
  byokProvider  String      @default("anthropic")
  byokVerified  Boolean     @default(false)  // tested?
  byokLastTest  DateTime?
  
  // Model preferences
  defaultModel  ClaudeModel @default(SONNET)
  allowedModels String[]    @default(["HAIKU", "SONNET", "OPUS"])
  
  // Limits (optional)
  monthlyCapUsd Decimal?    @db.Decimal(10, 2)
  
  updatedAt     DateTime    @updatedAt
}
```

### Subscriptions (للـ SaaS phase - معطّل في single-tenant)

```prisma
model Subscription {
  id                     String             @id @default(cuid())
  companyId              String             @unique
  planId                 String
  
  status                 SubscriptionStatus @default(TRIAL)
  
  // Payment provider
  provider               String?
  providerCustomerId     String?
  providerSubscriptionId String?
  
  currentPeriodStart     DateTime
  currentPeriodEnd       DateTime
  // Auto-renewal (recurring Tap charge) is planned; today renewal is manual.
  
  invoices               Invoice[]
  
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}

// (Plan, Invoice models remain the same as original DATABASE.md)
```

---

## 🔍 Indexes Strategy

```sql
-- Multi-tenant filtering (most important)
CREATE INDEX ON tasks (company_id);
CREATE INDEX ON agents (company_id);
CREATE INDEX ON orders (company_id);
CREATE INDEX ON public_conversations (company_id);

-- Common queries
CREATE INDEX ON agents (company_id, status);
CREATE INDEX ON tasks (agent_id, status, created_at DESC);
CREATE INDEX ON task_attempts (task_id, attempt_number);
CREATE INDEX ON approvals (company_id, status);

-- Vector similarity (semantic memory)
CREATE INDEX agent_memory_embedding_idx 
ON agent_memories 
USING ivfflat (embedding vector_cosine_ops);

-- Public conversations
CREATE INDEX ON public_conversations (visitor_id);
CREATE INDEX ON public_conversations (company_id, session_started DESC);

-- Domain routing
CREATE INDEX ON companies (custom_domain);
CREATE INDEX ON companies (slug);
```

---

## 🌱 Seed Data المطلوب

في `prisma/seed.ts`:

### 1. Plans (للـ SaaS phase)
- Free, Starter (99 SAR), Growth (299 SAR), Scale (799 SAR)

### 2. Skills الأساسية
- Saudi VAT Calculation
- ZATCA E-Invoice
- Arabic SEO
- Saudi Dialect Communication
- Hijri Calendar Awareness
- WhatsApp Business
- General Marketing
- Customer Service Best Practices
- Sales Techniques
- Bookkeeping Basics

### 3. Tools الأساسية (built-in)
- send_message
- create_task
- request_approval
- save_memory
- handoff_to_agent

### 4. Department Templates (لكل صناعة)
- E-commerce: Sales, Marketing, CS, Accounting, Logistics
- Agency: Project Management, Creative, CS, Accounting
- Services: Operations, Sales, CS
- Tech: Engineering, Product, Sales, Marketing

### 5. Super Admin User
- وليد (email + password from prompt)

---

## 📈 توقعات حجم البيانات (مع 100 عميل في SaaS phase)

| الجدول | عدد متوقع | حجم |
|---|---|---|
| Users | ~300 | < 1 MB |
| Companies | ~100 | < 1 MB |
| Agents | ~1,000 | < 5 MB |
| Tasks | 50K/شهر | ~50 MB/شهر |
| ChatMessages | 500K/شهر | ~500 MB/شهر |
| AgentMemories | 30K | ~150 MB |
| PublicConversations | 200K/شهر | ~200 MB/شهر |

**الإجمالي بعد سنة:** ~10 GB - PostgreSQL يتحمل بسهولة.

---

**الخلاصة:** هذا الـ Schema يدعم النموذجين (Multi-Tenant SaaS + Single-Tenant) بنفس الكود، وفيه كل ما يحتاجه الموظف الذكي من ذاكرة وقدرات.

النسخة الكاملة في `prisma/schema.prisma`. ✅

---

## 🔐 Row-Level Security (added 2026-06-20)

RLS is **enabled + forced** on 26 tenant tables (`20260620170000_rls_policies`)
as defense-in-depth over app-level `companyId` scoping. The `tenant_isolation`
policy is **permissive when no tenant is pinned**:

```sql
USING (
  current_setting('app.current_tenant_id', true) IS NULL
  OR current_setting('app.current_tenant_id', true) = ''
  OR "companyId" = current_setting('app.current_tenant_id', true)
)  -- + identical WITH CHECK
```

So un-pinned queries (everything today, except the HR hire tx) behave exactly as
before. To **pin** a tenant and get DB-enforced isolation, wrap work in
`withTenant()` (`lib/db-tenant.ts`), which runs a tx that first calls
`set_config('app.current_tenant_id', <companyId>, true)` (transaction-local,
pooling-safe). `User` is excluded so auth always works. **To fully enforce:** adopt
`withTenant` across tenant queries, then drop the permissive `IS NULL` fallback.
Rollback: `ALTER TABLE <t> DISABLE ROW LEVEL SECURITY`.

## 🆕 Schema additions (2026-06-20)

- **`RefCounter`** — per-(company,entity) counter for human-readable refs (`CUS-001`).
- **`AgentTemplate`** — 9 global hiring blueprints (personality, instructions,
  scenarios, KPIs, permissions); `Agent.templateId/isCustom/kpis/performanceScore`.
- **`Agent`** lifecycle/token fields — `AgentStatus` gains `ONBOARDING`;
  `tokenLimit/periodTokensUsed/periodStartedAt` (per-agent monthly cap).
- **`Company.plan`** (`PlanTier`) — onboarding plan choice.
- **`TriggerEvent`** gains `CART_ABANDONED` + `COMPLAINT_RECEIVED`.
- **`BusinessSettings.telegramBotToken/telegramChatId`** — escalation channel.

## 🆕 Schema additions (2026-06-21)

- **`Agent.permissions`** (`TEXT[]`) — explicit function-calling allow-list (tool
  ids). Enforced in `getToolsForAgent` (module ∩ permissions; empty = all). Set
  from the template's `defaultPermissions` or custom toggles.
- **`Company.tokenBalance`** default `100000` → **`5000000`** (the 100k starter
  grant drained in a few gemini-2.5-flash chats). Migration also restores any
  account currently `< 5M` (test phase).
- **`AgentMemory` vector index** ivfflat → **HNSW** (`vector_cosine_ops`).
- Used by the Super Admin console (no new tables — `Plan`, `Subscription`,
  `Invoice`, `AuditLog`, `PlatformSettings` already existed). See `docs/ADMIN.md`.

## 🆕 Schema additions (2026-06-22)

The customer-facing + storage arc:

- **Wallet** — `Wallet` (SAR balance) + `WalletTransaction` (ledger;
  `WalletTxType` incl. `SUBSCRIPTION`). Top-up via Tap; spends on token credits /
  services / subscriptions.
- **Marketplace** — `MarketplaceService` (+ `grantStorageBytes` for storage
  add-ons) + `ServicePurchase` (`ServicePurchaseStatus`).
- **Subscriptions** — `Plan` catalog seeded (+ `Plan.maxStorageBytes`); `Subscription`
  + `Invoice` now used (pay from wallet or Tap; `Invoice.providerInvoiceId @unique`).
- **CRM** — `LeadStatus += DEFERRED`; new `CustomerNote` (NOTE/VISIT activity log).
- **Storage** — `File` registry (RLS) + `Company.storageUsedBytes` /
  `storageLimitBytes` (BigInt quota; per-plan ceiling + per-tenant override). Image
  bodies are compressed (sharp → WebP) before R2. See `docs/STORAGE.md`.
- **Admin from env** — `PlatformSettings.tokenPricePerMillion`; super-admin
  bootstrapped from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## 🆕 Schema additions (2026-07-08)

- **Per-tenant email sender** — `BusinessSettings.emailSenderName`,
  `emailReplyTo`, `marketingEmailsEnabled` (all mail sends through the central
  Resend account from the platform domain; these brand the sender + gate
  marketing). Public orders now capture `Order.customerEmail` / `Customer.email`.
  See `lib/notifications/tenant-email.ts`.
- **Multi-agent Phase 1 (foundation):** `Agent.jobDescription` (nullable TEXT) —
  the agent's "constitution" (mandate + boundaries, distinct from `persona`),
  injected into the system prompt. The **per-department permission matrix** is a UI
  grouping over the existing `Agent.permissions` hard gate (no schema change). Later
  phases (Skills, orchestration) are not in the schema yet. See `docs/AGENT_SYSTEM.md`.
- **Guardrails (2026-07-09):** `Company.{automationEnabled, requireApprovalForSensitive,
  requireMessageReview, spendApprovalCapEnabled, spendApprovalCapSar}` — owner governance
  injected into `buildSystemPrompt` and gating the scheduler. `Agent.autonomy`
  (`AutonomyLevel`: SUGGEST/ASK/AUTOPILOT). See `docs/AGENT_SYSTEM.md → Guardrails & Autonomy`.
- **Business modules (2026-07-09, migration `20260709120000_coupons_inventory_staff`):**
  - `Coupon` — discount codes (`CouponType` PERCENT/FIXED, `CouponScope`
    ALL/PRODUCTS/SERVICES/BOOKINGS, min-subtotal, max-redemptions, window). `Order`
    gains `couponId` + `discount`. Validated by `checkCoupon()` (`lib/actions/coupons.ts`).
  - `InventoryItem` — consumables/raw materials (`quantityOnHand`, `reorderLevel`,
    `unit`, `unitCost`, supplier). Low-stock when `quantityOnHand <= reorderLevel`.
  - `StaffMember` — human service staff + commission rule (`CommissionType`
    PERCENT_SALES/FIXED_PER_ORDER/TARGET_BONUS, `commissionRate`, `monthlyTarget`).
    `Order`/`Booking` gain `staffMemberId`; `/commissions` computes earnings from
    attributed COMPLETED orders/bookings (no ledger table — derived on read).
- **Env/observability** are code-only (no schema): `APP_ENV` three-environment
  config (`lib/env.ts`), Sentry, and `GET /api/health`.
- **Bookings engine (deterministic).** `ServiceAvailability` (weekly windows per
  bookable service) + `Service.durationMin` / `bufferMin` / `maxCapacity` +
  `Booking.serviceId`. A service is bookable when `durationMin` is set AND it has
  ≥1 availability window; slots are generated server-side by `lib/booking/engine.ts`
  (timezone-aware, capacity-safe). Agents create/manage bookings only via tools
  that route through this engine (bookings permission). Migration
  `20260708140000_bookings_engine`.

Migrations: `20260621130000_wallet` … `20260708140000_bookings_engine`.
