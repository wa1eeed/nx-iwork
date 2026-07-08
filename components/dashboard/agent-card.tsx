'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Zap } from 'lucide-react';
import type { AgentStatus } from '@prisma/client';
import { cn } from '@/lib/utils';
import { HolographicAvatar } from '@/components/dashboard/holographic-avatar';
import { resolveApproval } from '@/lib/actions/approvals';

export interface AgentCardData {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string | null;
  approvalId: string | null; // set → NEEDS-YOU
  trigger: string | null;
  modelTier: string; // "Fast" | "Balanced" | "Advanced"
}

const AVATAR_STATUS: Record<AgentStatus, 'ONLINE' | 'ONBOARDING' | 'PAUSED' | 'IDLE' | 'ARCHIVED'> = {
  ONLINE: 'ONLINE',
  WORKING: 'ONLINE',
  ONBOARDING: 'ONBOARDING',
  PAUSED: 'PAUSED',
  OFFLINE: 'IDLE',
  ARCHIVED: 'ARCHIVED',
};

export function AgentCard({ agent, hue }: { agent: AgentCardData; hue: number }) {
  const t = useTranslations('overview');
  const router = useRouter();
  const [pending, start] = useTransition();
  const needsYou = Boolean(agent.approvalId);
  const idle = agent.status === 'PAUSED' || agent.status === 'OFFLINE';

  const act = (decision: 'approve' | 'reject') =>
    start(async () => {
      if (!agent.approvalId) return;
      const res = await resolveApproval(agent.approvalId, decision);
      if (res.ok) {
        toast.success(decision === 'approve' ? t('approved') : t('sentBack'));
        router.refresh();
      } else toast.error(t('actionFailed'));
    });

  return (
    <Link
      href={`/agents/${agent.id}`}
      style={{ ['--dept-h' as string]: String(hue) }}
      className={cn(
        'group flex gap-3 rounded-2xl border p-3.5 transition-colors',
        needsYou ? 'dept-tint-bg dept-accent-border border-[1.5px]' : 'border-border bg-card hover:bg-accent/40',
        idle && !needsYou && 'opacity-[0.86]',
      )}
    >
      <HolographicAvatar
        seed={agent.id}
        hue={hue}
        size={46}
        status={needsYou ? 'NEEDS_YOU' : AVATAR_STATUS[agent.status]}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{agent.name}</p>
        <p className="truncate text-[11.5px] text-muted-foreground">{agent.role}</p>

        <p className="mt-1 line-clamp-2 text-[12.5px] text-foreground/80">
          {agent.currentTask ?? t(`statusLine.${agent.status}`)}
        </p>

        {needsYou ? (
          <div className="mt-2 flex gap-1.5" onClick={(e) => e.preventDefault()}>
            <button
              onClick={() => act('approve')}
              disabled={pending}
              className="rounded-lg bg-[oklch(0.6_0.13_155)] px-3 py-1 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {t('approve')}
            </button>
            <button
              onClick={() => act('reject')}
              disabled={pending}
              className="rounded-lg border border-input px-3 py-1 text-[11px] text-muted-foreground transition hover:bg-accent disabled:opacity-50"
            >
              {t('sendBack')}
            </button>
          </div>
        ) : agent.status === 'ONLINE' || agent.status === 'WORKING' ? (
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div className="h-full w-2/3 dept-accent-bg" />
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {agent.trigger && (
              <span className="dept-tint-bg dept-accent-text inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]">
                <Zap className="h-3 w-3" />
                {agent.trigger}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-md bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full dept-dot" />
              {agent.modelTier}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
