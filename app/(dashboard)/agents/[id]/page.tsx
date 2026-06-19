import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { AgentForm, type AgentFormValues } from '@/components/dashboard/agent-form';
import { ArchiveAgentButton } from '@/components/dashboard/archive-agent-button';

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const [agent, departments, managers] = await Promise.all([
    db.agent.findFirst({ where: { id, companyId } }),
    db.department.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    db.agent.findMany({
      where: { companyId, status: { not: 'ARCHIVED' }, NOT: { id } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!agent) notFound();

  const initial: AgentFormValues = {
    id: agent.id,
    name: agent.name,
    nameEn: agent.nameEn ?? '',
    role: agent.role,
    roleEn: agent.roleEn ?? '',
    persona: agent.persona,
    departmentId: agent.departmentId,
    parentId: agent.parentId ?? '',
    model: agent.model,
    temperature: agent.temperature,
    systemPrompt: agent.systemPrompt ?? '',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          الموظفون
        </Link>
        <ArchiveAgentButton id={agent.id} />
      </div>
      <h1 className="text-2xl font-semibold">تعديل الموظف</h1>
      <AgentForm departments={departments} managers={managers} initial={initial} />
    </div>
  );
}
