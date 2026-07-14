import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { McpServersManager, type McpRow } from '@/components/dashboard/mcp-servers-manager';

export default async function IntegrationsPage() {
  const t = await getTranslations('pages.integrations');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const servers = companyId
    ? await db.mcpServer.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, key: true, url: true, isActive: true, authToken: true },
      })
    : [];

  const rows: McpRow[] = servers.map((s) => ({
    id: s.id,
    name: s.name,
    key: s.key,
    url: s.url,
    isActive: s.isActive,
    hasAuth: !!s.authToken,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <McpServersManager servers={rows} />
    </div>
  );
}
