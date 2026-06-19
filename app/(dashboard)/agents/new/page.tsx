import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { AgentForm } from '@/components/dashboard/agent-form';

export default async function NewAgentPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const [departments, managers] = companyId
    ? await Promise.all([
        db.department.findMany({
          where: { companyId },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true },
        }),
        db.agent.findMany({
          where: { companyId, status: { not: 'ARCHIVED' } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        الموظفون
      </Link>
      <h1 className="text-2xl font-semibold">موظف جديد</h1>
      <AgentForm departments={departments} managers={managers} />
    </div>
  );
}
