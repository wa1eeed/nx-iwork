'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { updateGuardrails } from '@/lib/actions/guardrails';

// Top-bar automation switch. Flipping it off pauses the scheduler + event
// triggers for the whole tenant (the cron loop skips paused companies) — the
// same flag the Guardrails "Scheduler & triggers" master toggle controls.
export function AutomationToggle({ initialOn }: { initialOn: boolean }) {
  const t = useTranslations('agentControls.automation');
  const [on, setOn] = useState(initialOn);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      const res = await updateGuardrails({ automationEnabled: next });
      if (!res.ok) setOn(!next); // revert on failure
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={toggle}
      title={t('title')}
      className="hidden items-center gap-2 rounded-full border bg-card/60 px-3 py-1.5 text-sm transition hover:bg-card disabled:opacity-70 lg:flex"
    >
      <span className="relative flex size-2">
        {on && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60" />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${
            on ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          }`}
        />
      </span>
      <span className="text-muted-foreground">{on ? 'Automation on' : 'Automation paused'}</span>
      <span
        className="relative h-[18px] w-8 rounded-full transition-colors"
        style={{ backgroundColor: on ? '#16a34a' : '#d8cfbd' }}
      >
        <span
          className="absolute top-[2px] size-[14px] rounded-full bg-white shadow transition-all duration-200"
          style={{ insetInlineStart: on ? 16 : 2 }}
        />
      </span>
    </button>
  );
}
