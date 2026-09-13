import { getLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { dashboardCompanyIdOrRedirect } from '@/lib/companies';
import { ensureConductor } from '@/lib/agent/conductor';
import { getCommandState } from '@/lib/command/state';
import { CommandCenter } from '@/components/dashboard/command-center';

// The Command Center — the platform's cockpit. A live neon radar of the AI
// workforce (who's online, who's working, what each is doing) orbiting the
// Maestro (the conductor), beside a chat/voice console to command it: the
// Maestro builds and configures the other agents from the conversation.
export const dynamic = 'force-dynamic';

export default async function CommandPage() {
  const session = await auth();
  const companyId = await dashboardCompanyIdOrRedirect(session);

  // Provision the Maestro on first visit (idempotent), then snapshot the fleet.
  const conductor = await ensureConductor(companyId);
  const [state, locale] = await Promise.all([getCommandState(companyId), getLocale()]);

  return (
    <CommandCenter
      initial={state}
      conductorId={conductor.id}
      locale={locale === 'en' ? 'en' : 'ar'}
    />
  );
}
