# 🧠 Agent System - The Brain of NX iWork

> **This is the most important technical file in the project.** It describes how the real "smart employee" works - not an ordinary chatbot.

> **🆕 2026-07-16 — agent-module redesign.** The configuration/governance layer
> described below was overhauled; the authoritative record is
> [`AGENT_MODULE_REDESIGN.md`](./AGENT_MODULE_REDESIGN.md). Headlines that
> supersede older statements in this file:
> - **ONE model picker** — the registry dropdown (filtered to the company's
>   ACTIVE provider) replaced the tier cards; a cross-provider pick can no
>   longer be silently dropped. The tier remains a fallback only.
> - **ONE instructions field** — `jobDescription` governs behavior; the
>   free-text `persona` + `systemPrompt` textareas were retired from the form
>   (persona is derived server-side via `derivePersonaSummary`).
> - **Per-agent governance** — `Agent.{requireApprovalForSensitive,
>   requireMessageReview,spendApprovalCapSar}` (null = inherit company),
>   resolved by `resolveGuardrails()` and injected on chat/task/sandbox.
> - **Verbosity → `maxTokens`** (2048/4096/8192) and temperature presets.
> - **Owner-editable KPIs** (custom hires seed from the archetype) and an
>   **effective-capabilities** display (permissions ∪ skill tools + MCP).
> - **`search_catalog`** matches Arabic word variants across
>   title/subtitle/description, returns up to 30 items, and falls back to the
>   full catalog (kind-agnostic) on no match. The customer prompt **requires**
>   a catalog call for any price/availability answer, and directs agents to
>   `list_object_types`/`query_records` for owner-defined data (both now on
>   the public-widget allowlist, still permission-gated).
> - **Thinking budgets:** public widget `1024` (reliable tool use);
>   internal dashboard chat `0` (speed).

---

## 🎯 Core philosophy

**The smart employee ≠ Chatbot**

| Ordinary chatbot | NX iWork Agent |
|---|---|
| Replies to a message, that's it | Wakes up on several triggers |
| Remembers nothing | 3-layer memory |
| Doesn't know your company | Knows the full Company DNA |
| Executes a single command | Can hand off to another employee, request approval, decide |
| Stateless | Stateful with a timeline |

---

## ⚖️ The two-layer contract (agent design law)

- **The system** (deterministic code inside the workflow) owns transactions: invoices,
  bookings, orders, CRM records — programmatically and with high reliability.
- **The agents** do the human work: judgment, natural-language communication (with customers
  and among themselves), ambiguity, initiative, cross-department coordination. The agent is
  aware of the system's state, decides within policy, communicates, and **triggers** the workflow
  — but does not "record the invoice" itself (the system does that).

**Agent architecture direction:** **Phase 1 ✅ implemented** = the **Job Description** constitution
(`Agent.jobDescription`, governs the agent and is injected into the system prompt, separate from
`persona`) + a **per-department permissions matrix** (tools grouped by department above the strict
`getToolsForAgent` gate, including cross-department permissions) + a "feasibility check" in the
create UI. **Coming next (planned):** phase 2 = a composable **Skills** system · phase 3 =
**orchestration** (an internal event bus + `delegate_to_agent` / `request_from_agent` / `depends_on`) ·
phase 4 = an operations center (bookings calendar + agent-tasks calendar + a tracking page). See
[`ROADMAP.md`](./ROADMAP.md).

---

## 🧩 The three-layer role model (sector-agnostic)

Every agent is defined by three layers, all editable from the create/edit UI:

1. **Archetype** — a ready-made capability bundle in [`lib/agent/archetypes.ts`](../lib/agent/archetypes.ts):
   6 sector-agnostic archetypes (`front_desk` · `sales` · `care` · `marketing` ·
   `operations` · `finance`), each seeding: permissions (tools) + KPIs + output
   types + default autonomy + an initial persona + **surface** (`surface`).
2. **Persona — structured** in [`lib/agent/persona.ts`](../lib/agent/persona.ts):
   tone + verbosity + language policy + "do/avoid" + phrases, deterministically compiled into the
   prompt via `compilePersona`. The free-text `Agent.persona` field is now only a summary/fallback.
3. **Mandate** — `Agent.jobDescription` + `autonomy` + governance controls.

**Restricting customer service (`Agent.surface`):** only `CUSTOMER_FACING` serves the site widget;
`INTERNAL` (marketing/finance/operations) never replies to a customer — it works in the background
and hands off to the center. Enforced in [`public-chat.ts`](../lib/agent/public-chat.ts) + the widget
route + intake. The `list_bookings` / `set_booking_staff` tools are internal only (they carry PII / an owner action).

## 📦 The agent outputs hub (Agent Workspace)

A unified place `/outputs` for everything the team produces: the `AgentOutput` model
(`MESSAGE`/`REPORT`/`PLAN`/`CONTENT`/`ANALYSIS`/`ACTION_LOG`, with a
`DRAFT→READY→APPROVED→PUBLISHED`/`ARCHIVED` lifecycle). Background agents deliver via the
`create_output` tool instead of just chatting, and each agent's slice appears on its profile
(`/agents/[id]` outputs tab). Review is via `setOutputStatus` ([`lib/actions/outputs.ts`](../lib/actions/outputs.ts)).

---

## 🧠 Per-agent AI model (Model Registry)

Every agent can run on a specific AI model chosen by the owner — not limited to a tier
(HAIKU/SONNET/OPUS). `Agent.aiModelId` points to a row in **`AiModel`** (managed from
`/admin/models`), and an "AI model" dropdown appears in the agent create/edit form. `null` →
the tier default. The chosen model **pins its provider** at runtime (Gemini/OpenAI/Claude),
so you can run one agent on GPT-4o and another on Gemini within the same company. **Adding a new
model = a data row, not a deployment.** Details: [`AI_VERTEX.md`](./AI_VERTEX.md) §2b.

---

## 🗂️ Business Objects as a tool for agents

When the owner defines their own data types (patient/vehicle/contract… via `/data`), agents
automatically get generic tools to read and write them — grouped under the `data` group in the
permissions matrix, and governed by `CompanyModules.hasObjects` (not handed over unless at least
one type exists, to keep the context lean):

- **`list_object_types`** — discovers the types and their fields (called first).
- **`query_records`** — searches a type's records (title + JSON scan), scoped to the tenant.
- **`create_record`** / **`update_record`** — writes, with validation against the field schema
  (`lib/objects/fields.ts`); `values` are passed as a JSON string (portable across all providers).

These tools are **excluded from the public widget's list** (`PUBLIC_ALLOWLIST`) because business
data can be sensitive — so only dashboard chat and autonomous tasks touch them. The full strategy:
[`OPENCLAW_PARITY.md`](./OPENCLAW_PARITY.md).

---

## 🏗️ The full Architecture

```
┌────────────────────────────────────────────────┐
│               THE AGENT LOOP                   │
│                                                │
│  1. TRIGGER → wakes up                         │
│  2. LOAD CONTEXT → load memory (+ recall)      │
│  3. THINK → reason w/ provider (Gemini/Claude) │
│  4. ACT → execute via tools (tool loop)        │
│  5. REMEMBER → persist (save_memory)           │
│  6. SLEEP → sleep (until next trigger)         │
└────────────────────────────────────────────────┘
```

> ✅ **Implementation status:** the core is built on a neutral AI layer (`lib/ai/`, Gemini by default + Claude).
> The shared core `lib/agent/core.ts` (context loading + the tool loop) is used by both chat
> (`run.ts`) and task execution (`task.ts`). Implemented tools: `search_catalog`, `find_customer`,
> `create_lead`, `update_lead`, `create_task`, `save_memory` (`lib/agent/tools.ts`).
> Scheduling via `lib/agent/scheduler.ts` + the `scripts/scheduler.ts` worker. Semantic memory
> via `lib/agent/memory.ts` (pgvector). All tools are **internal and direct** via
> function-calling, gated by `getToolsForAgent` (module ∩ `permissions`) — with no dependency on
> external integrations.

---

## 🔔 Stage 1: Triggers (when does it wake up?)

Every Agent has **5 types of triggers**:

### 1. User Message Trigger
- The business owner sent a message in the internal chat
- A visitor sent a message in the chat widget on the public site
- **Latency:** immediate (real-time streaming)

### 2. Task Assignment Trigger
- The business owner assigned it a task from the dashboard
- Another employee handed it a task (handoff)
- **Latency:** immediate (background job)

### 3. Schedule Trigger
- A recurring schedule: "daily at 9 AM"
- "weekly on Sunday"
- "every hour"
- **Latency:** per the schedule

### 4. Webhook Trigger
- An external system sent an event (e.g., a new customer registered from a Form)
- External integration via the public API (planned)
- **Latency:** immediate

### 5. Inter-Agent Trigger
- Another employee asked it for something
- e.g., the sales employee handed off to the accountant to issue an invoice
- **Latency:** immediate

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

## 🧠 Stage 2: Load Context (memory)

Every employee has **3 memory layers**:

### Layer 1: Working Memory (inside each call's context)

**What it is:** the employee's last 20 messages/events

**Storage:** within the system prompt + messages array

**Example:**
```typescript
const workingMemory = {
  recentMessages: [...last20Messages],
  currentTask: task,
  currentConversation: conversation,
};
```

**Size:** ~5,000 tokens

### Layer 2: Episodic Memory (in the DB)

**What it is:** all past tasks and conversations (full details)

**Storage:** PostgreSQL tables (Tasks, ChatMessages, TaskAttempts)

**How we use it:**
- When we need "has this customer asked about this product before?"
- We run a query in the DB and get the history

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

**What it is:** semantic summaries of important events (long-term memory)

**Storage:** PostgreSQL with the pgvector extension

**Creation:**
- Every night, a job summarizes the employee's day
- Converts the summary into embeddings
- Saves it in the `agent_memories` table

**Retrieval:**
- When the employee starts a new task
- It searches for similar memories
- Injects them into the system prompt

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

## 🤔 Stage 3: Think (reasoning with Claude)

### Tool Use Architecture

We use **Claude's Tool Use** (function calling) so the employee can:

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

## ⚡ Stage 4: Act (execution)

Every tool has a handler:

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

When the employee needs human approval:

1. Creates an Approval record
2. Pauses the current task → status = `PENDING_APPROVAL`
3. Sends a notification to the business owner
4. The business owner opens the "Approval Inbox"
5. Approves/rejects/edits
6. The employee wakes up and continues

---

## 💾 Stage 5: Remember (saving)

After each cycle:

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

## 🌙 Stage 6: Sleep (Daily Summary Job)

Every night at 2:00 AM:

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

Every Agent has a **persona** (a fixed personality):

```typescript
const persona = {
  name: "Sara",              // Arabic display name
  nameEn: "Sarah",
  role: "Marketing team lead",
  characteristics: [
    "Creative and professional",
    "Writes in a friendly but professional style",
    "Focuses on Saudi content",
    "Loves data and analytics"
  ],
  communicationStyle: "Friendly, concise, uses emoji sparingly",
  values: ["Quality", "Creativity", "Speed"],
  tone: "Professional but warm",
  language: "Eloquent Arabic with a Gulf touch",
};
```

This compiles into a system prompt:

```
You are Sarah, the marketing team lead at {company.name}.

Your personality:
- Creative and professional
- You write in a friendly but professional style
- You focus on Saudi content
- You love data and analytics

Communication style: friendly, concise, emoji in moderation
Values: quality, creativity, speed

Language: eloquent Arabic with a Gulf touch
```

---

## 🔧 Skills vs Tools

### Skills (knowledge)
**What they are:** understanding a specific context, patterns, best practices

**Examples:**
- "Saudi VAT Calculation" - understands the Saudi tax system
- "Arabic SEO" - understands SEO for the Arabic market
- "ZATCA Invoice" - understands e-invoice requirements

**Application:** added to the system prompt as instructional text

### Tools (execution)
**What they are:** **internal** tools via function-calling, gated by `getToolsForAgent` (module ∩ `permissions`) — a strict gate: the model cannot reach a tool it wasn't handed.

**Examples (implemented):**
- `search_catalog` · `find_customer` · `create_lead` / `update_lead` · `create_task` · `save_memory`

> Additional capabilities (social media posting, external integrations) come via the **planned Skills system**, not via n8n (cancelled).

**Application:** added to the tools array in the Claude API call

---

## 📊 Performance Considerations

### Token Optimization
- Use **Haiku** for simple tasks (90% of tasks)
- Use **Sonnet** for medium tasks (8%)
- Use **Opus** for complex tasks only (2%)

### Cost Estimation per Agent
- An active employee: ~$5-15/month (BYOK, paid by the customer)
- 10 employees: ~$50-150/month for the customer
- Low-usage employees: $1-3/month

### Caching Strategy
- Company DNA cache for 1 hour
- Skills definitions cache forever (until update)
- Semantic memory cache for current conversation

---

## 🚨 Failure Modes & Recovery

### 1. API Limit Reached
**Detection:** Anthropic returns 429
**Solution:** Save state, retry with exponential backoff
**Display:** a "Failed" tab with reason + retry button

### 2. External Tool Failed
**Detection:** external API/integration timeout / 5xx
**Solution:** Mark task as failed, suggest alternative
**Display:** a "Failed" tab with reason

### 3. Permission Denied
**Detection:** External API returns 403
**Solution:** Request approval to re-link account
**Display:** Notification + Approval Inbox

### 4. Conflicting Data
**Detection:** Validation fails (e.g., a duplicate customer)
**Solution:** Pause task, request human decision
**Display:** Approval Inbox

### 5. Hallucination Detection
**Detection:** Output doesn't match schema
**Solution:** Retry with structured output enforcement
**Display:** Hidden retry, log for analysis

---

## 🎓 Best Practices for training Agents

### 1. A clear and specific Persona
❌ "A smart marketing employee"
✅ "Sarah, a Saudi marketing lead, 10 years of e-commerce experience, writes in a modern style"

### 2. Specific, measurable Skills
❌ "Knows marketing"
✅ "ZATCA Compliance, Arabic SEO, Instagram Ad Targeting"

### 3. Examples in the System Prompt
Give the employee 3-5 examples of good decisions:
```
Example 1:
User: "Write a post for a new product"
Sarah's response: [a good example]
```

### 4. Clear Boundaries
Define clearly:
- What it can decide on its own
- What needs approval
- What it hands off to a human

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
"قواعد الحوكمة (إلزامية)" ("Governance rules (mandatory)") block that **takes precedence over the autonomy level**.

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

**This is the technical heart of the platform.** Building this system correctly = the success of NX iWork.

**The bottom line of every line here:** a real smart employee, not a chatbot.
