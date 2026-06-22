-- "Buy extra storage" marketplace add-ons: a service whose purchase raises the
-- tenant's storage ceiling by grantStorageBytes.

ALTER TABLE "MarketplaceService" ADD COLUMN "grantStorageBytes" BIGINT;

INSERT INTO "MarketplaceService" (
  "id", "title", "titleAr", "description", "descriptionAr",
  "price", "icon", "category", "active", "sortOrder", "grantStorageBytes",
  "createdAt", "updatedAt"
) VALUES
  ('svc_storage_5gb',  '+5 GB storage',  'مساحة +5 جيجا',
   'Add 5 GB to your storage ceiling.', 'أضِف 5 جيجابايت إلى سعة تخزينك.',
   29,  'server', 'storage', true, 10, 5368709120,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('svc_storage_20gb', '+20 GB storage', 'مساحة +20 جيجا',
   'Add 20 GB to your storage ceiling.', 'أضِف 20 جيجابايت إلى سعة تخزينك.',
   99,  'database', 'storage', true, 11, 21474836480, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
