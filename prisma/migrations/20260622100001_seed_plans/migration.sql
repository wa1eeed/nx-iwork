-- Seed the Plan catalog so subscriptions can reference real Plan rows.
-- Idempotent (ON CONFLICT on the unique tier). Prices in SAR/month.
INSERT INTO "Plan" (
  "id", "tier", "name", "nameEn", "priceMonthly", "priceYearly",
  "maxAgents", "maxDepartments", "maxMembers",
  "allowCustomDomain", "allowCustomBranding", "allowApiAccess", "prioritySupport",
  "features", "isActive", "sortOrder", "createdAt", "updatedAt"
) VALUES
  ('plan_free',       'FREE',       'مجانية',   'Free',       0,   0,    1,  1,  1, false, false, false, false, '[]'::jsonb, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_starter',    'STARTER',    'الأساسية', 'Starter',    0,   0,    2,  2,  1, false, false, false, false, '[]'::jsonb, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_growth',     'GROWTH',     'النمو',    'Growth',     99,  990,  10, 10, 5, true,  false, false, true,  '[]'::jsonb, true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_scale',      'SCALE',      'التوسّع',  'Scale',      299, 2990, -1, -1, -1, true, true,  true,  true,  '[]'::jsonb, true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_enterprise', 'ENTERPRISE', 'المؤسسات', 'Enterprise', 0,   0,    -1, -1, -1, true, true,  true,  true,  '[]'::jsonb, true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tier") DO NOTHING;
