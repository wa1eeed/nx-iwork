'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { setAgentPaused } from '@/lib/actions/agents';

// Primary header action on the agent workspace (design View 2). Pausing flips
// the agent to PAUSED — the scheduler then skips it until resumed.
export function PauseAgentButton({ id, paused }: { id: string; paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const res = await setAgentPaused(id, !paused);
      if (res.ok) {
        toast.success(!paused ? 'Agent paused' : 'Agent resumed');
        router.refresh();
      } else {
        toast.error('Could not update the agent.');
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : paused ? (
        <Play className="size-4" />
      ) : (
        <Pause className="size-4" />
      )}
      {paused ? 'Resume' : 'Pause agent'}
    </button>
  );
}
