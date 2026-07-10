'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { archiveAgent } from '@/lib/actions/agents';
import { useConfirm } from '@/components/ui/confirm-dialog';

// Archive (soft-delete) keeps the agent's chat history and task records intact.
export function ArchiveAgentButton({ id }: { id: string }) {
  const t = useTranslations('agentControls.archive');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();

  async function onArchive() {
    if (!(await confirm({ title: t('confirm'), destructive: true, confirmLabel: tc('delete'), cancelLabel: tc('cancel') }))) return;
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
