# 🧠 Agent System - The Brain of NX iWork

> **هذا أهم ملف تقني في المشروع.** يصف كيف يعمل "الموظف الذكي" الحقيقي - مش chatbot عادي.

---

## 🎯 الفلسفة الأساسية

**الموظف الذكي ≠ Chatbot**

| Chatbot عادي | NX iWork Agent |
|---|---|
| يرد على رسالة، خلاص | يستيقظ بعدة triggers |
| ما يتذكر شي | ذاكرة 3 طبقات |
| ما يعرف شركتك | يعرف Company DNA كاملة |
| ينفذ أمر واحد | يقدر يحوّل لموظف ثاني، يطلب موافقة، يقرر |
| Stateless | Stateful مع timeline |

---

## ⚖️ العقد ثنائي الطبقة (قانون تصميم الوكلاء)

- **النظام** (كود حتمي داخل الوورك فلو) يملك المعاملات: الفواتير، الحجوزات، الطلبات،
  سجلات CRM — برمجياً وبموثوقية عالية.
- **الوكلاء** يؤدّون العمل الإنساني: الحكم، التواصل باللغة الطبيعية (مع العملاء وفيما
  بينهم)، الغموض، المبادرة، التنسيق بين الأقسام. الوكيل يُدرِك حالة النظام، يقرّر ضمن
  السياسة، يتواصل، و**يشغّل** الوورك فلو — ولا «يسجّل الفاتورة» بنفسه (النظام يفعل ذلك).

**اتجاه معمارية الوكلاء:** **المرحلة 1 ✅ مُنفَّذة** = دستور **Job Description**
(`Agent.jobDescription`، يحكم الوكيل ويُحقن في الـsystem prompt، منفصل عن `persona`) +
**مصفوفة صلاحيات per-department** (تبويب الأدوات حسب القسم فوق البوّابة الصارمة
`getToolsForAgent`، تشمل صلاحيات عبر الأقسام) + «اختبار الجدوى» في واجهة الإنشاء.
**القادم (مخطّط):** المرحلة 2 = نظام **Skills** قابل للتركيب · المرحلة 3 = **تنسيق**
(ناقل أحداث داخلي + `delegate_to_agent` / `request_from_agent` / `depends_on`) ·
المرحلة 4 = مركز عمليات (تقويم حجوزات + تقويم مهام الوكلاء + صفحة تتبّع). راجع
[`ROADMAP.md`](./ROADMAP.md).

---

## 🏗️ Architecture الكامل

```
┌────────────────────────────────────────────────┐
│               THE AGENT LOOP                   │
│                                                │
│  1. TRIGGER → يستيقظ                          │
│  2. LOAD CONTEXT → يحمّل ذاكرته (+ recall)     │
│  3. THINK → يفكر مع مزوّد الشركة (Gemini/Claude)│
│  4. ACT → ينفذ عبر الأدوات (tool loop)         │
│  5. REMEMBER → يحفظ (save_memory)             │
│  6. SLEEP → ينام (حتى التريقر التالي)          │
└────────────────────────────────────────────────┘
```

> ✅ **حالة التنفيذ:** النواة مبنية عبر طبقة AI محايدة (`lib/ai/`, Gemini افتراضي + Claude).
> النواة المشتركة `lib/agent/core.ts` (تحميل السياق + حلقة الأدوات) تستخدمها المحادثة
> (`run.ts`) وتنفيذ المهام (`task.ts`). الأدوات المُنفَّذة: `search_catalog`, `find_customer`,
> `create_lead`, `update_lead`, `create_task`, `save_memory` (`lib/agent/tools.ts`).
> الجدولة عبر `lib/agent/scheduler.ts` + worker `scripts/scheduler.ts`. الذاكرة الدلالية
> عبر `lib/agent/memory.ts` (pgvector). الأدوات كلها **داخلية ومباشرة** عبر
> function-calling، مبوّبة بـ `getToolsForAgent` (module ∩ `permissions`) — لا اعتماد على
> تكاملات خارجية.

---

## 🔔 المرحلة 1: Triggers (متى يستيقظ؟)

كل Agent عنده **5 أنواع triggers**:

### 1. User Message Trigger
- صاحب البزنس أرسل رسالة في chat الداخلي
- زائر أرسل رسالة في chat widget على الموقع العام
- **Latency:** فوري (real-time streaming)

### 2. Task Assignment Trigger
- صاحب البزنس كلّفه بمهمة من dashboard
- موظف ثاني أحاله مهمة (handoff)
- **Latency:** فوري (background job)

### 3. Schedule Trigger
- جدولة دورية: "يومياً 9 صباحاً"
- "أسبوعياً يوم الأحد"
- "كل ساعة"
- **Latency:** حسب الجدول

### 4. Webhook Trigger
- نظام خارجي أرسل event (مثلاً: عميل جديد سجّل من Form)
- تكامل خارجي عبر الـ API العام (مخطّط)
- **Latency:** فوري

### 5. Inter-Agent Trigger
- موظف ثاني طلب منه شي
- مثلاً: موظف المبيعات أحال للمحاسب لإصدار فاتورة
- **Latency:** فوري

### Implementation:

```typescript
// lib/claude/triggers.ts

export type AgentTrigger = {
  type: 'USER_MESSAGE' | 'TASK_ASSIGNMENT' | 'SCHEDULE' | 'WEBHOOK' | 'INTER_AGENT';
  agentId: string;
  payload: any;
  source: { type: string; id: string };
  timestamp: Date;
};

export async function wakeAgent(trigger: AgentTrigger) {
  const agent = await loadAgent(trigger.agentId);
  if (agent.status === 'PAUSED') return;
  
  await runAgentLoop(agent, trigger);
}
```

---

## 🧠 المرحلة 2: Load Context (الذاكرة)

كل موظف عنده **3 طبقات ذاكرة**:

### Layer 1: Working Memory (داخل context كل call)

**ما هي:** آخر 20 رسالة/حدث للموظف

**التخزين:** ضمن system prompt + messages array

**المثال:**
```typescript
const workingMemory = {
  recentMessages: [...last20Messages],
  currentTask: task,
  currentConversation: conversation,
};
```

**الحجم:** ~5,000 tokens

### Layer 2: Episodic Memory (في DB)

**ما هي:** كل المهام والمحادثات السابقة (تفاصيل كاملة)

**التخزين:** PostgreSQL tables (Tasks, ChatMessages, TaskAttempts)

**كيف نستخدمها:**
- لما نحتاج "هل هذا العميل سأل عن المنتج هذا قبل؟"
- نسوي query في DB ونحصل على history

```typescript
async function getEpisodicMemory(agentId: string, query: {
  customerId?: string;
  topic?: string;
  dateRange?: [Date, Date];
}) {
  return prisma.task.findMany({
    where: { agentId, ...query },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
}
```

### Layer 3: Semantic Memory (Vector DB)

**ما هي:** ملخصات معنوية للأحداث المهمة (ذاكرة طويلة المدى)

**التخزين:** PostgreSQL مع pgvector extension

**الإنشاء:**
- كل ليلة، job يلخّص يوم الموظف
- يحوّل الملخص لـ embeddings
- يحفظه في `agent_memories` table

**الاسترجاع:**
- لما الموظف يبدأ مهمة جديدة
- يبحث عن ذكريات مشابهة
- يحقنها في system prompt

```typescript
async function getSemanticMemory(agentId: string, query: string) {
  const queryEmbedding = await embed(query);
  
  const memories = await prisma.$queryRaw`
    SELECT id, summary, importance, created_at
    FROM agent_memories
    WHERE agent_id = ${agentId}
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT 5
  `;
  
  return memories;
}
```

### Final Context Assembly:

```typescript
async function buildContext(agent: Agent, trigger: AgentTrigger) {
  return {
    systemPrompt: `
      ${agent.persona}
      
      === Company Context ===
      ${await getCompanyDNA(agent.companyId)}
      
      === Your Skills ===
      ${formatSkills(agent.skills)}
      
      === Available Tools ===
      ${formatTools(agent.tools)}
      
      === Long-term Memories (relevant) ===
      ${await getSemanticMemory(agent.id, trigger.payload.query)}
      
      === Current Date/Time ===
      ${formatDateTime(agent.company.timezone)}
    `,
    messages: await getWorkingMemory(agent.id),
  };
}
```

---

## 🤔 المرحلة 3: Think (التفكير مع Claude)

### Tool Use Architecture

نستخدم **Claude's Tool Use** (function calling) ليقدر الموظف:

```typescript
const tools = [
  {
    name: "send_message",
    description: "Send a message to the user/customer",
    input_schema: { type: "object", properties: {
      content: { type: "string" }
    }}
  },
  {
    name: "create_task",
    description: "Create a new task for yourself or another agent",
    input_schema: { type: "object", properties: {
      title: { type: "string" },
      assignee: { type: "string", enum: ["self", "another_agent"] },
      assigneeId: { type: "string" }
    }}
  },
  {
    name: "request_approval",
    description: "Request human approval for sensitive decisions",
    input_schema: { type: "object", properties: {
      decision: { type: "string" },
      options: { type: "array", items: { type: "string" } }
    }}
  },
  // planned (orchestration phase): hand a sub-task to another department's agent
  {
    name: "delegate_to_agent",
    description: "Delegate a sub-task to another agent (planned)",
    input_schema: { type: "object", properties: {
      agentId: { type: "string" },
      task: { type: "string" }
    }}
  },
  {
    name: "save_memory",
    description: "Save an important fact to long-term memory",
    input_schema: { type: "object", properties: {
      summary: { type: "string" },
      importance: { type: "number", min: 1, max: 10 }
    }}
  },
  {
    name: "handoff_to_agent",
    description: "Hand off the conversation to another agent",
    input_schema: { type: "object", properties: {
      agentId: { type: "string" },
      reason: { type: "string" }
    }}
  },
];
```

### Think Loop

```typescript
async function think(context, trigger) {
  let response = await claude.messages.create({
    model: agent.model, // haiku/sonnet/opus
    system: context.systemPrompt,
    messages: [...context.messages, formatTrigger(trigger)],
    tools: tools,
    max_tokens: 4096,
  });
  
  // Handle tool use loop
  while (response.stop_reason === 'tool_use') {
    const toolResults = await Promise.all(
      response.content
        .filter(b => b.type === 'tool_use')
        .map(async (toolCall) => ({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: await executeTool(toolCall.name, toolCall.input),
        }))
    );
    
    response = await claude.messages.create({
      model: agent.model,
      system: context.systemPrompt,
      messages: [
        ...context.messages,
        formatTrigger(trigger),
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ],
      tools: tools,
      max_tokens: 4096,
    });
  }
  
  return response;
}
```

---

## ⚡ المرحلة 4: Act (التنفيذ)

كل tool له handler:

```typescript
async function executeTool(toolName: string, input: any) {
  switch (toolName) {
    case 'send_message':
      return await saveAndStreamMessage(input.content);
      
    case 'create_task':
      return await createTask(input);
      
    case 'request_approval':
      return await createApproval(input);
      
    case 'delegate_to_agent': // planned (orchestration phase)
      return await delegateToAgent(input.agentId, input.task);
      
    case 'save_memory':
      return await saveSemanticMemory(input);
      
    case 'handoff_to_agent':
      return await handoffToAgent(input.agentId, input.reason);
  }
}
```

### Approval System

لما الموظف يحتاج موافقة بشرية:

1. ينشئ Approval record
2. يوقف المهمة الحالية → status = `PENDING_APPROVAL`
3. يرسل notification لصاحب البزنس
4. صاحب البزنس يفتح "Approval Inbox"
5. يوافق/يرفض/يعدّل
6. الموظف يصحى ويكمل

---

## 💾 المرحلة 5: Remember (الحفظ)

بعد كل cycle:

### 1. Update Working Memory
```typescript
await prisma.chatMessage.create({
  data: {
    agentId, 
    role: 'AGENT',
    content: response.content,
    metadata: { toolCalls, tokensUsed }
  }
});
```

### 2. Update Timeline
```typescript
await prisma.timelineEvent.create({
  data: {
    companyId,
    agentId,
    type: 'TASK_COMPLETED',
    title: 'Completed: ' + task.title,
    metadata: { taskId, result }
  }
});
```

### 3. Update Stats
```typescript
await prisma.agent.update({
  where: { id: agentId },
  data: {
    tasksCompleted: { increment: 1 },
    totalTokensUsed: { increment: tokensUsed }
  }
});
```

### 4. Failure Handling
```typescript
if (failed) {
  await prisma.taskAttempt.create({
    data: {
      taskId,
      agentId,
      status: 'FAILED',
      errorReason: error.message,
      errorType: classifyError(error), // 'API_LIMIT', 'PERMISSION', 'EXTERNAL_API_ERROR', etc.
      retryable: isRetryable(error)
    }
  });
}
```

---

## 🌙 المرحلة 6: Sleep (Daily Summary Job)

كل ليلة 2:00 ص:

```typescript
async function nightlyConsolidation() {
  for (const agent of activeAgents) {
    const todaysEvents = await getTodaysActivity(agent.id);
    
    if (todaysEvents.length === 0) continue;
    
    // Use Haiku (cheap) to summarize
    const summary = await claude.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize this agent's day in 2-3 sentences, focusing on important learnings and decisions:\n\n${formatEvents(todaysEvents)}`
      }]
    });
    
    // Save as semantic memory with embedding
    const embedding = await embed(summary.content[0].text);
    
    await prisma.$executeRaw`
      INSERT INTO agent_memories (agent_id, summary, embedding, importance, created_at)
      VALUES (${agent.id}, ${summary}, ${embedding}::vector, ${importance}, NOW())
    `;
  }
}
```

---

## 🎭 Persona System

كل Agent عنده **persona** (شخصية ثابتة):

```typescript
const persona = {
  name: "سارة",
  nameEn: "Sarah",
  role: "قائدة فريق التسويق",
  characteristics: [
    "إبداعية ومحترفة",
    "تكتب بأسلوب ودود لكن مهني",
    "تركز على المحتوى السعودي",
    "تحب البيانات والتحليلات"
  ],
  communicationStyle: "ودودة، مختصرة، تستخدم الإيموجي بحدود",
  values: ["الجودة", "الإبداع", "السرعة"],
  tone: "محترف لكن دافئ",
  language: "عربي فصيح مع لمسات خليجية",
};
```

هذا يتحوّل لـ system prompt:

```
أنت سارة، قائدة فريق التسويق في {company.name}.

شخصيتك:
- إبداعية ومحترفة
- تكتبين بأسلوب ودود لكن مهني
- تركزين على المحتوى السعودي
- تحبين البيانات والتحليلات

أسلوب التواصل: ودود، مختصر، إيموجي بحدود
القيم: الجودة، الإبداع، السرعة

اللغة: عربي فصيح مع لمسات خليجية
```

---

## 🔧 Skills vs Tools

### Skills (المعرفة)
**ما هي:** فهم سياق محدد، patterns، best practices

**أمثلة:**
- "Saudi VAT Calculation" - يفهم نظام الضريبة السعودي
- "Arabic SEO" - يفهم SEO للسوق العربي
- "ZATCA Invoice" - يفهم متطلبات الفاتورة الإلكترونية

**التطبيق:** يضاف لـ system prompt كنص تعليمي

### Tools (التنفيذ)
**ما هي:** أدوات **داخلية** عبر function-calling، مبوّبة بـ `getToolsForAgent` (module ∩ `permissions`) — بوّابة صارمة: النموذج لا يصل لأداة لم تُسلَّم له.

**أمثلة (مُنفَّذة):**
- `search_catalog` · `find_customer` · `create_lead` / `update_lead` · `create_task` · `save_memory`

> قدرات إضافية (نشر سوشيال ميديا، تكاملات خارجية) تأتي عبر **نظام Skills المخطّط**، لا عبر n8n (أُلغي).

**التطبيق:** يضاف للـ tools array في Claude API call

---

## 📊 Performance Considerations

### Token Optimization
- استخدم **Haiku** للمهام البسيطة (90% من المهام)
- استخدم **Sonnet** للمهام المتوسطة (8%)
- استخدم **Opus** للمهام المعقدة فقط (2%)

### Cost Estimation per Agent
- موظف نشط: ~$5-15/شهر (BYOK، يدفعها العميل)
- 10 موظفين: ~$50-150/شهر للعميل
- موظفين قليلي الاستخدام: $1-3/شهر

### Caching Strategy
- Company DNA cache for 1 hour
- Skills definitions cache forever (until update)
- Semantic memory cache for current conversation

---

## 🚨 Failure Modes & Recovery

### 1. API Limit Reached
**الكشف:** Anthropic returns 429
**الحل:** Save state, retry with exponential backoff
**العرض:** Tab "فشل" مع reason + retry button

### 2. External Tool Failed
**الكشف:** external API/integration timeout / 5xx
**الحل:** Mark task as failed, suggest alternative
**العرض:** Tab "فشل" مع reason

### 3. Permission Denied
**الكشف:** External API returns 403
**الحل:** Request approval to re-link account
**العرض:** Notification + Approval Inbox

### 4. Conflicting Data
**الكشف:** Validation fails (مثلاً: عميل مكرر)
**الحل:** Pause task, request human decision
**العرض:** Approval Inbox

### 5. Hallucination Detection
**الكشف:** Output doesn't match schema
**الحل:** Retry with structured output enforcement
**العرض:** Hidden retry, log for analysis

---

## 🎓 Best Practices لتعليم الـ Agents

### 1. Persona واضحة ومحددة
❌ "موظف تسويق ذكي"
✅ "سارة، قائدة تسويق سعودية، 10 سنوات خبرة في التجارة الإلكترونية، تكتب بأسلوب عصري"

### 2. Skills محددة وقابلة للقياس
❌ "تعرف التسويق"
✅ "ZATCA Compliance, Arabic SEO, Instagram Ad Targeting"

### 3. Examples في System Prompt
أعطِ الموظف 3-5 أمثلة على القرارات الجيدة:
```
Example 1:
User: "اكتب منشور لمنتج جديد"
Sarah's response: [مثال جيد]
```

### 4. Boundaries واضحة
حدد بوضوح:
- ما يقدر يقرره وحده
- ما يحتاج موافقة
- ما يحوّله لإنسان

---

## 🔬 Testing Agents

### Unit Tests
- Agent responds within expected persona
- Tool calls have correct schema
- Memory retrieval works

### Integration Tests
- Multi-agent handoff flow
- Approval flow end-to-end
- Schedule triggers

### Behavioral Tests
- Agent doesn't reveal sensitive info
- Agent escalates correctly
- Agent maintains tone over long conversations

---

## 🏛️ HR Agent — Lifecycle & Hiring Gateway (built 2026-06-20)

Every digital employee is **hired through one gateway** —
`hrAgent.onboardAndDeployAgent` in `lib/agent/hr-agent.ts`. **Never call
`db.agent.create` directly**: that bypasses conflict-check, onboarding, scenario
materialization, and the per-agent token cap.

### The mandatory 7-step pipeline
1. **Intake** — the add-agent UI (`/agents/new`) or `POST /api/hr/deploy` (so an
   autonomous CEO agent can raise a strategic-hiring request).
2. **Path resolution** — template vs custom (`resolvePayload`).
3. **Conflict & redundancy check** — `lib/agent/conflict-check.ts`:
   `gemini-2.5-flash` (via the Vertex provider) flags a >80%-overlap duplicate
   role, names the existing employee, recommends modifying it. Fail-open; charges
   managed tokens. Blocks with `HRConflictError` unless `force`.
4. **Scenario & tool fine-tuning** — if-then scenarios → live `EventTrigger`s.
5. **Hierarchy placement** — `direct_manager_id` = `parentId` (validated to tenant).
6. **Cognitive onboarding** — `lib/agent/cognitive-onboarding.ts` seeds the new
   agent's `AgentMemory` from business context + FAQ, embedded 1536-dim with
   `gemini-embedding-001`, so it works knowledgeably from message one.
7. **Activation** — status `ONBOARDING → ONLINE`; the agent appears on the org
   chart. The create tx pins `app.current_tenant_id` (RLS hook, see DATABASE.md).

### System templates (`AgentTemplate`)
Nine platform-wide blueprints (seeded via migration): Sales, Support, Marketing,
Operations, Finance, Appointments, Lead Qualifier (SDR), Social Media, Account
Manager — each with `personalityProfile`, `coreInstructions`, `ifThenScenarios`,
`defaultKpis`, `defaultPermissions`, `model`, `icon`, `accent`. Hybrid creation
copies a blueprint into a tenant-scoped `Agent` (`isCustom=false`, `templateId`
set, KPIs copied) and materializes its scenarios.

### Per-agent token cap
The HR service sets `Agent.tokenLimit` from the company plan
(`lib/plans.ts` `AGENT_TOKEN_CAP`). `lib/billing/agent-tokens.ts`
(`checkAgentBudget`/`chargeAgentTokens`, UTC monthly reset) enforces it in all
three run paths so one agent can't drain the shared token bank.

### Complaint escalation
Inbound public-chat messages run `lib/agent/sentiment.ts` (free keyword gate →
`gemini-2.5-flash` confirm). An angry complaint fires `COMPLAINT_RECEIVED` (waking
the assigned agent) and pings the owner's Telegram (`lib/notify/telegram.ts`,
per-company bot configured in Settings → Alerts).

### UI surfaces
- `/agents/new` — template browser + custom builder + HR advisory + scenario builder.
- Agent profile tabs — Activity · Scenarios · **KPIs & performance** · **Memory** · Settings.
- Employees page — Grid ⇄ **Org chart** (`components/dashboard/organization-chart.tsx`).

---

## 🗣️ Conversation modes — customer vs owner (built 2026-06-21)

The same agent talks to two very different people, so the system prompt
(`buildSystemPrompt`, `lib/agent/prompt.ts`) branches on `audience`:

- **`customer`** (default) — the **public chat widget** (`public-chat.ts`). The
  interlocutor is a real customer: greet, answer from catalog/FAQ, capture leads
  into the CRM, escalate. This is the customer-service stance.
- **`internal`** — the **dashboard chat** (`run.ts`) **and autonomous task
  execution** (`task.ts`). The interlocutor is the **business owner / manager**.
  The agent acts as their employee: it takes directives, **executes actions via
  its tools** (record/update an order, update a lead, create a task, check
  availability…), and reports back concisely — it does **not** treat the owner as
  a customer or log them into the CRM.

This is the answer to "why did my agent reply to me like I'm a customer?" — the
dashboard now runs in `internal` mode.

**The hybrid principle this enforces:** customer-facing transactions (a visitor
ordering on the public page) are **deterministic pure code** (`/api/public/[slug]/order`
→ the `Order` table) — agents are NOT in that path. Agents are the augmentation
layer: they *can* take the same actions via function-calling **when directed by
the owner or by a scenario**, each within its role and permissions.

## 🔐 Per-agent tool permissions (function-calling allow-list)

`Agent.permissions` is an explicit allow-list of tool ids. The runtime gate is
`getToolsForAgent(modules, permissions)` (`lib/agent/tools.ts`): an agent receives
a tool only if it is **both module-enabled AND in its permissions** — the model
can never call a tool it wasn't handed. **Empty list = all module tools**
(backward compatible for agents created before permissions existed). Template
hires get the template's `defaultPermissions`; custom agents pick via toggles in
the agent form (create + edit). Shown on the profile as the agent's real
capabilities.

## 🛡️ Guardrails & Autonomy (built 2026-07-09)

The owner's controls over the workforce — the human-in-the-loop half of the
two-layer contract, made concrete.

**Autonomy dial** (`Agent.autonomy`, enum `AutonomyLevel`) — how far an agent acts
before pausing for the owner:
- `SUGGEST` — propose only; never act. Always `request_approval` first.
- `ASK` (default) — do routine work directly; `request_approval` for sensitive or
  irreversible decisions.
- `AUTOPILOT` — act within policy; approval only for the truly exceptional.

It's injected into `buildSystemPrompt` as an explicit instruction block, so the
model's `request_approval` behaviour follows the dial.

**Company guardrails** (`Company.*`, editable from the Guardrails tab at `/settings`
and the top-bar Automation toggle) — these **override** the autonomy dial:
- `automationEnabled` — master switch for the scheduler + event triggers. When
  `false`, `runDueSchedules`/`runDueTasks` (`lib/agent/scheduler.ts`) **skip the
  whole tenant** — every agent is effectively paused. (Individual agents are also
  skipped when `status = PAUSED`, via the workspace "Pause agent" action.)
- `requireApprovalForSensitive` — sensitive/irreversible decisions must pause via
  `request_approval`.
- `spendApprovalCapEnabled` + `spendApprovalCapSar` — any spend/discount above the
  cap needs approval.
- `requireMessageReview` — customer-facing drafts wait for owner review before send.

The active guardrails are passed to `buildSystemPrompt({ guardrails })` (loaded in
`loadAgentWithContext`, wired by `run.ts` + `task.ts`) and rendered as a mandatory
"قواعد الحوكمة (إلزامية)" block that **takes precedence over the autonomy level**.

**Approval loop** (both halves): the agent calls `request_approval` → an `Approval`
row (`PENDING`) + an `APPROVAL_REQUESTED` timeline event → surfaced in the Command
Center rail, the `/approvals` inbox, and the agent's NEEDS-YOU state → the owner
resolves via `resolveApproval` (`lib/actions/approvals.ts`), which records the
decision and **wakes the agent** with a follow-up `AGENT_TOOL` task.

> **Autonomy only happens if the scheduler runs.** In production the scheduler is
> driven by an external cron hitting `POST /api/cron/run` (header
> `x-cron-secret: $CRON_SECRET`) every minute, or the `npm run scheduler` worker.
> If `CRON_SECRET` is unset the cron endpoint is disabled (503) → no autonomous runs.

## 🛡️ Resilience & token accounting

- **Rate limiter** (`lib/ai/retry.ts` `withAiRetry`) — exponential backoff + full
  jitter on transient Gemini errors (429/RESOURCE_EXHAUSTED, 5xx, timeouts);
  wraps `complete()`, `completeStream()`, and the embeddings call.
- **Token accounting** — charged on the **real** `usageMetadata.totalTokenCount`
  (input + output + Gemini "thinking" tokens), computed in the Vertex adapter as
  `inputTokens = promptTokenCount`, `outputTokens = total − prompt`. No
  compounding. The starter grant is **5,000,000** tokens (`Company.tokenBalance`;
  100k drained in ~10 chats). Each chat logs `[token-guard] surface | tenant | used | remaining`.
- **Streaming** — the dashboard chat streams the reply token-by-token over SSE
  (`provider.completeStream` → `runToolLoopStream` → `onDelta` → SSE route →
  client). Tool-using turns resolve first, then the final answer streams.
- **Per-agent monthly cap** — `lib/billing/agent-tokens.ts` (by plan), on top of
  the company bank.

---

**هذا هو القلب التقني للمنصة.** بناء هذا الـ system بشكل صحيح = نجاح NX iWork.

**نتيجة كل سطر هنا:** موظف ذكي حقيقي، مش chatbot.
