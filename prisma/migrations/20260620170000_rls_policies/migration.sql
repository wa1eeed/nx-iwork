-- Row-Level Security for tenant isolation (defense in depth on top of the
-- app-level companyId scoping).
--
-- SAFETY: the policy is permissive when no tenant is pinned —
--   current_setting('app.current_tenant_id', true) IS NULL  -> allow
-- so every existing query (which sets no GUC) behaves exactly as before and the
-- live app keeps working. Isolation is ENFORCED only inside a transaction that
-- runs `SELECT set_config('app.current_tenant_id', <companyId>, true)` first
-- (see lib/db-tenant.ts withTenant + the HR Agent service). This lets us adopt
-- per-tenant pinning incrementally without a flag day.
--
-- FORCE is required so the table owner (the app role) is also subject to the
-- policy; combined with the permissive fallback this is safe.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Agent','AgentMemory','AgentSchedule','Approval','AuditLog','Booking',
    'BusinessSettings','ChatMessage','CompanyApiSettings','CompanyDNA','Customer',
    'Department','EventTrigger','FaqItem','Invoice','Notification','Order',
    'Product','PublicConversation','RefCounter','Service','Subscription','Task',
    'TaskAttempt','TimelineEvent','WebsiteConfig'
  ];
  cond text := $c$(
    current_setting('app.current_tenant_id', true) IS NULL
    OR current_setting('app.current_tenant_id', true) = ''
    OR "companyId" = current_setting('app.current_tenant_id', true)
  )$c$;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING %s WITH CHECK %s',
      t, cond, cond
    );
  END LOOP;
END $$;
