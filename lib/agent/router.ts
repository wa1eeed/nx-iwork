// Inbound router: pick the customer-facing agent best suited to a fresh channel
// message when a company runs more than one. Deterministic keyword scoring over
// each agent's role + department + persona — free, fast, and no AI call in the
// webhook hot path. Only affects NEW threads; an existing conversation keeps its
// original agent (getOrCreateConversation reuses the stored agentId), so a thread
// never ping-pongs between agents mid-conversation.

import { db } from '@/lib/db';

// Arabic + Latin aware; keep words of length >= 3 to drop noise.
function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
  );
}

export async function routeInboundAgent(
  companyId: string,
  defaultAgentId: string,
  message: string
): Promise<string> {
  const agents = await db.agent.findMany({
    where: { companyId, surface: 'CUSTOMER_FACING', status: { in: ['ONLINE', 'WORKING'] } },
    select: {
      id: true,
      role: true,
      roleEn: true,
      persona: true,
      department: { select: { name: true, nameEn: true } },
    },
  });
  // Nothing to route between — keep the channel's default agent.
  if (agents.length <= 1) return defaultAgentId;

  const words = tokenize(message);
  if (words.size === 0) return defaultAgentId;

  let best = defaultAgentId;
  let bestScore = 0;
  for (const a of agents) {
    const hay = tokenize(
      [a.role, a.roleEn, a.persona, a.department?.name, a.department?.nameEn].filter(Boolean).join(' ')
    );
    let score = 0;
    for (const w of words) if (hay.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = a.id;
    }
  }
  // No signal → don't guess; stick with the channel default.
  return bestScore > 0 ? best : defaultAgentId;
}
