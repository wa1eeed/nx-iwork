// Shared builder for the Command Center's live snapshot — used by the server
// page (initial render, no flash) and the polling API route (live updates).
// Company-scoped; read-only; no PII beyond agent/department names.

import { db } from '@/lib/db';

export type AgentStatusLite = 'ONBOARDING' | 'ONLINE' | 'WORKING' | 'PAUSED' | 'OFFLINE' | 'ARCHIVED';

export interface CommandAgent {
  id: string;
  name: string;
  nameEn: string | null;
  initial: string;
  role: string;
  roleEn: string | null;
  status: AgentStatusLite;
  scope: 'customer' | 'internal';
  isConductor: boolean;
  department: string | null;
  tasksCompleted: number;
  activity: string | null;
  activityAt: string | null;
}

export interface CommandActivity {
  id: string;
  type: string;
  title: string;
  agentId: string | null;
  agentName: string | null;
  at: string;
}

export interface CommandState {
  conductorId: string | null;
  stats: { total: number; online: number; working: number; paused: number };
  pendingApprovals: number;
  agents: CommandAgent[];
  activity: CommandActivity[];
}

export async function getCommandState(companyId: string): Promise<CommandState> {
  const [agents, events, pendingApprovals] = await Promise.all([
    db.agent.findMany({
      where: { companyId, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, nameEn: true, initial: true, role: true, roleEn: true,
        status: true, surface: true, archetype: true, tasksCompleted: true,
        department: { select: { name: true } },
      },
    }),
    db.timelineEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true, type: true, title: true, createdAt: true,
        agentId: true, agent: { select: { name: true } },
      },
    }),
    db.approval.count({ where: { companyId, status: 'PENDING' } }),
  ]);

  // Latest event per agent → "what this agent is doing right now".
  const latestByAgent = new Map<string, { title: string; at: string }>();
  for (const e of events) {
    if (e.agentId && !latestByAgent.has(e.agentId)) {
      latestByAgent.set(e.agentId, { title: e.title, at: e.createdAt.toISOString() });
    }
  }

  const conductor = agents.find((a) => a.archetype === 'conductor') ?? null;

  return {
    conductorId: conductor?.id ?? null,
    stats: {
      total: agents.length,
      online: agents.filter((a) => a.status === 'ONLINE').length,
      working: agents.filter((a) => a.status === 'WORKING').length,
      paused: agents.filter((a) => a.status === 'PAUSED' || a.status === 'OFFLINE').length,
    },
    pendingApprovals,
    agents: agents.map((a) => {
      const act = latestByAgent.get(a.id) ?? null;
      return {
        id: a.id,
        name: a.name,
        nameEn: a.nameEn,
        initial: a.initial,
        role: a.role,
        roleEn: a.roleEn,
        status: a.status as AgentStatusLite,
        scope: a.surface === 'CUSTOMER_FACING' ? 'customer' : 'internal',
        isConductor: a.archetype === 'conductor',
        department: a.department?.name ?? null,
        tasksCompleted: a.tasksCompleted,
        activity: act?.title ?? null,
        activityAt: act?.at ?? null,
      };
    }),
    activity: events.slice(0, 12).map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      agentId: e.agentId,
      agentName: e.agent?.name ?? null,
      at: e.createdAt.toISOString(),
    })),
  };
}
