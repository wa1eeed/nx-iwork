import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { SkillsManager, type SkillRow } from '@/components/dashboard/skills-manager';

export default async function SkillsPage() {
  const t = await getTranslations('pages.skills');
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [skills, agents] = companyId
    ? await Promise.all([
        db.skill.findMany({
          where: { companyId },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            promptTemplate: true,
            tools: true,
            agents: { select: { agentId: true } },
          },
        }),
        db.agent.findMany({
          where: { companyId, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  const rows: SkillRow[] = skills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description === '—' ? '' : s.description,
    icon: s.icon,
    instructions: s.promptTemplate ?? '',
    tools: s.tools,
    agentIds: s.agents.map((a) => a.agentId),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SkillsManager skills={rows} agents={agents} />
    </div>
  );
}
