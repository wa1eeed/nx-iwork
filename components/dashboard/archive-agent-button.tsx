'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { archiveAgent } from '@/lib/actions/agents';

// Archive (soft-delete) keeps the agent's chat history and task records intact.
export function ArchiveAgentButton({ id }: { id: string }) {
  const t = useTranslations('agentControls.archive');
  const router = useRouter();
  const [pending, start] = useTransition();

  function onArchive() {
    if (!window.confirm(t('confirm'))) return;
    start(async () => {
      const res = await archiveAgent(id);
      if (res.ok) {
        toast.success(t('archived'));
        router.push('/agents');
        router.refresh();
      } else {
        toast.error(t('error'));
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onArchive}
      disabled={pending}
      className="text-destructive hover:text-destructive"
    >
      {pending ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <Archive className="me-1 h-4 w-4" />}
      {t('archive')}
    </Button>
  );
}
