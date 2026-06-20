import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { getAiMode } from '@/lib/ai';
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

  // Managed mode: the platform supplies AI — agents are always ready, no key.
  const managed = getAiMode() === 'managed';
  const keyReady = managed || !!apiSettings?.byokVerified;
  const provider = managed ? 'google' : apiSettings?.byokProvider ?? 'anthropic';

  if (agents.length === 0) {
    return <ChatEmptyState hasCompany keyReady={keyReady} />;
  }

  // Load saved conversation history per agent so each agent's chat persists
  // across reloads (the messages are already stored in ChatMessage).
  const recent = await db.chatMessage.findMany({
    where: { companyId, agentId: { in: agents.map((a) => a.id) }, role: { in: ['USER', 'AGENT'] } },
    orderBy: { createdAt: 'asc' },
    select: { agentId: true, role: true, content: true, createdAt: true },
  });
  const initialThreads: Record<string, { id: string; role: 'user' | 'agent'; content: string }[]> = {};
  for (const m of recent) {
    (initialThreads[m.agentId] ??= []).push({
      id: `${m.agentId}-${m.createdAt.getTime()}-${m.role}`,
      role: m.role === 'AGENT' ? 'agent' : 'user',
      content: m.content,
    });
  }

  return (
    <ChatClient agents={agents} keyReady={keyReady} provider={provider} initialThreads={initialThreads} />
  );
}
