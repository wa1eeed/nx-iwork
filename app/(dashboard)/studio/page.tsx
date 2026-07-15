import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { StudioClient, type StudioAgent } from '@/components/dashboard/studio-client';

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const { agent: agentParam } = await searchParams;
  const t = await getTranslations('pages.studio');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const agents = companyId
    ? await db.agent.findMany({
        where: { companyId, status: { not: 'ARCHIVED' } },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          role: true,
          surface: true,
          aiModel: { select: { label: true } },
        },
      })
    : [];

  const list: StudioAgent[] = agents.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    surface: a.surface,
    model: a.aiModel?.label ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <StudioClient agents={list} initialAgentId={agentParam} />
    </div>
  );
}
