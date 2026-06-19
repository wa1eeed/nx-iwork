import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ChatClient } from '@/components/dashboard/chat-client';
import { ChatEmptyState } from '@/components/dashboard/chat-empty-state';

// Server component: loads the company's agents, then hands off to the client
// chat UI. Tenant isolation comes from scoping every query by companyId.
export default async function ChatPage() {
  const session = await auth();
  const companyId = session?.user?.id
    ? await getUserCompany(session.user.id)
    : null;

  if (!companyId) {
    // Layout already redirects unauthenticated/un-onboarded users; this guards.
    return <ChatEmptyState hasCompany={false} />;
  }

  const [agents, apiSettings] = await Promise.all([
    db.agent.findMany({
      where: { companyId, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        initial: true,
        role: true,
        status: true,
      },
    }),
    db.companyApiSettings.findUnique({
      where: { companyId },
      select: { byokVerified: true, byokProvider: true },
    }),
  ]);

  if (agents.length === 0) {
    return <ChatEmptyState hasCompany keyReady={!!apiSettings?.byokVerified} />;
  }

  return (
    <ChatClient
      agents={agents}
      keyReady={!!apiSettings?.byokVerified}
      provider={apiSettings?.byokProvider ?? 'anthropic'}
    />
  );
}
