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

## 🏗️ Architecture الكامل

```
┌────────────────────────────────────────────────┐
│               THE AGENT LOOP                   │
│                                                │
│  1. TRIGGER → يستيقظ                          │
│  2. LOAD CONTEXT → يحمّل ذاكرته                │
│  3. THINK → يفكر مع Claude                    │
│  4. ACT → ينفذ                                │
│  5. REMEMBER → يحفظ                           │
│  6. SLEEP → ينام (حتى التريقر التالي)          │
└────────────────────────────────────────────────┘
```

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
- n8n نبّهه (مثلاً: عميل جديد سجّل من Form)
- نظام خارجي أرسل event
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
  {
    name: "call_n8n_workflow",
    description: "Trigger an n8n workflow for external actions",
    input_schema: { type: "object", properties: {
      workflowId: { type: "string" },
      payload: { type: "object" }
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
      
    case 'call_n8n_workflow':
      return await callN8nWorkflow(input.workflowId, input.payload);
      
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
**ما هي:** قدرات تنفيذية فعلية (API calls, DB queries, n8n)

**أمثلة:**
- `send_email` - يرسل إيميل عبر Resend
- `post_to_instagram` - ينشر على انستقرام (n8n)
- `create_invoice` - ينشئ فاتورة

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

### 2. External Tool Failed (n8n down)
**الكشف:** webhook timeout / 5xx
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

**هذا هو القلب التقني للمنصة.** بناء هذا الـ system بشكل صحيح = نجاح NX iWork.

**نتيجة كل سطر هنا:** موظف ذكي حقيقي، مش chatbot.
