'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { HolographicAvatar } from '@/components/dashboard/holographic-avatar';
import { resolveApproval } from '@/lib/actions/approvals';

export interface ApprovalCardData {
  id: string;
  agentId: string;
  agentName: string;
  deptLabel: string;
  hue: number;
  decision: string;
  context: string | null;
}

export function ApprovalCard({ approval }: { approval: ApprovalCardData }) {
  const t = useTranslations('overview');
  const router = useRouter();
  const [pending, start] = useTransition();

  const act = (decision: 'approve' | 'reject') =>
    start(async () => {
      const res = await resolveApproval(approval.id, decision);
      if (res.ok) {
        toast.success(decision === 'approve' ? t('approved') : t('sentBack'));
        router.refresh();
      } else toast.error(t('actionFailed'));
    });

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-start gap-2.5">
        <HolographicAvatar seed={approval.agentId} hue={approval.hue} size={28} />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground">{approval.decision}</p>
          <p className="text-[11px] text-muted-foreground">
            {approval.agentName} · {approval.deptLabel}
          </p>
        </div>
      </div>

      {approval.context && (
        <p className="mt-2 rounded-lg bg-[hsl(var(--muted))] p-2.5 text-[11.5px] leading-relaxed text-foreground/75">
          {approval.context}
        </p>
      )}

      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => act('approve')}
          disabled={pending}
          className="flex-1 rounded-lg bg-[oklch(0.6_0.13_155)] py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {t('approve')}
        </button>
        <button
          onClick={() => act('reject')}
          disabled={pending}
          className="rounded-lg border border-input px-3 py-1.5 text-[12px] text-muted-foreground transition hover:bg-accent disabled:opacity-50"
        >
          {t('sendBack')}
        </button>
      </div>
    </div>
  );
}
