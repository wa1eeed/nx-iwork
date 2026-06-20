-- Agent lifecycle system: system templates + structured agent fields.

-- 1) AgentTemplate catalog (platform-wide blueprints).
CREATE TABLE "AgentTemplate" (
    "id" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "roleNameEn" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "departmentEn" TEXT NOT NULL,
    "roleDescription" TEXT NOT NULL,
    "roleDescriptionEn" TEXT NOT NULL,
    "personalityProfile" JSONB NOT NULL,
    "coreInstructions" TEXT NOT NULL,
    "ifThenScenarios" JSONB NOT NULL,
    "defaultKpis" JSONB NOT NULL,
    "defaultPermissions" JSONB NOT NULL,
    "model" "ClaudeModel" NOT NULL DEFAULT 'HAIKU',
    "icon" TEXT NOT NULL DEFAULT 'bot',
    "accent" TEXT NOT NULL DEFAULT '#06b6d4',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgentTemplate_templateType_key" ON "AgentTemplate"("templateType");

-- 2) Structured fields on Agent (hybrid creation + KPIs + performance).
ALTER TABLE "Agent" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Agent" ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Agent" ADD COLUMN "kpis" JSONB;
ALTER TABLE "Agent" ADD COLUMN "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 100;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Seed the three high-quality system templates. gen_random_uuid() is built
--    into Postgres 13+; ids only need to be unique.
INSERT INTO "AgentTemplate" (
  "id","templateType","roleName","roleNameEn","department","departmentEn",
  "roleDescription","roleDescriptionEn","personalityProfile","coreInstructions",
  "ifThenScenarios","defaultKpis","defaultPermissions","model","icon","accent","sortOrder","updatedAt"
) VALUES
(
  gen_random_uuid()::text, 'sales', 'موظف مبيعات', 'Sales Agent', 'المبيعات', 'Sales',
  'يحوّل الزوار والعملاء المحتملين إلى مبيعات عبر ردود سريعة ومقنعة ومتابعة ذكية.',
  'Turns visitors and leads into sales with fast, persuasive replies and smart follow-up.',
  '{"tone":"persuasive, energetic","traits":["confident","fast","consultative"],"priorities":["conversion_rate","response_speed"]}'::jsonb,
  'You are a high-performing sales agent. Greet leads warmly, qualify needs quickly, recommend the best-fit product or service from the catalog, handle objections, and always drive toward a clear next step (order, booking, or follow-up). Never invent prices or stock — read them from the catalog. Keep replies concise and confident.',
  '[{"event":"new_lead_captured","action":"Craft a personalized welcome and an initial tailored offer"},{"event":"abandoned_cart_detected","action":"Wait 30 minutes, then send a dynamic discount coupon"}]'::jsonb,
  '[{"key":"conversion_rate","label":"Conversion rate","target":20,"unit":"%"},{"key":"first_response","label":"First response","target":2,"unit":"min"},{"key":"leads_handled","label":"Leads handled","target":50,"unit":"/mo"}]'::jsonb,
  '["search_catalog","find_customer","create_lead","update_lead","create_order","create_task","save_memory"]'::jsonb,
  'SONNET','trending-up','#10b981',1,CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::text, 'support', 'موظف دعم العملاء', 'Support Agent', 'خدمة العملاء', 'Customer Support',
  'يقدّم دعماً فورياً ومتعاطفاً، ويصعّد للبشر عند الغضب الشديد أو الطلبات خارج نطاق المعرفة.',
  'Delivers instant, empathetic support and escalates to a human on strong anger or out-of-scope tickets.',
  '{"tone":"empathetic, calm, patient","traits":["empathetic","patient","clear"],"priorities":["csat","resolution_time"]}'::jsonb,
  'You are a calm, empathetic customer-support agent. Acknowledge the customer feelings, answer accurately from the FAQ/knowledge base instead of guessing, and resolve issues efficiently. If you detect strong anger or a high-priority issue beyond your knowledge, escalate to a human via the configured channel and create a follow-up task.',
  '[{"event":"angry_customer_detected","action":"De-escalate, apologize, and escalate to a human via the configured channel"},{"event":"out_of_scope_ticket","action":"Escalate high-priority tickets beyond current knowledge to a human"}]'::jsonb,
  '[{"key":"csat","label":"CSAT","target":90,"unit":"%"},{"key":"resolution_time","label":"Resolution time","target":10,"unit":"min"},{"key":"escalation_rate","label":"Escalation rate","target":10,"unit":"%"}]'::jsonb,
  '["search_faq","find_customer","update_lead","create_task","update_task_status","save_memory"]'::jsonb,
  'HAIKU','headphones','#06b6d4',2,CURRENT_TIMESTAMP
),
(
  gen_random_uuid()::text, 'marketing', 'موظف تسويق', 'Marketing Agent', 'التسويق', 'Marketing',
  'يصيغ المحتوى والحملات ويجدول المنشورات بناءً على أداء الحملات السابقة.',
  'Crafts content and campaigns and schedules posts based on past campaign performance.',
  '{"tone":"creative, informed","traits":["creative","analytical","trend-aware"],"priorities":["engagement","content_output"]}'::jsonb,
  'You are a creative, data-aware marketing agent. Draft on-brand content, plan campaigns, and propose improvements grounded in past performance. Keep the brand voice consistent and tie every idea to a measurable goal (engagement, reach, or conversions).',
  '[{"event":"campaign_underperforming","action":"Analyze and propose adjustments to copy and targeting"},{"event":"content_calendar_due","action":"Draft and schedule posts based on past campaign performance"}]'::jsonb,
  '[{"key":"engagement_rate","label":"Engagement rate","target":5,"unit":"%"},{"key":"posts_per_week","label":"Posts / week","target":5,"unit":""},{"key":"reach","label":"Reach","target":10000,"unit":"/mo"}]'::jsonb,
  '["search_catalog","search_faq","create_task","save_memory"]'::jsonb,
  'SONNET','megaphone','#8b5cf6',3,CURRENT_TIMESTAMP
);
