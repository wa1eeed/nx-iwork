'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Zap,
  Wallet as WalletIcon,
  ShieldCheck,
  MessageSquareText,
  CircleDollarSign,
  Gauge,
  Clock,
  ArrowRight,
  Play,
  Loader2,
} from 'lucide-react';
import { updateGuardrails, runAutomationNow, type GuardrailsPatch } from '@/lib/actions/guardrails';

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  SCALE: 'Scale',
  ENTERPRISE: 'Enterprise',
};

function compact(n: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

// Design toggle: 42×24 track, green on / #d8cfbd off (dark variant #4b4640),
// 18px white knob sliding 3→21px. Direction-safe via inset-inline-start.
function Toggle({
  on,
  onChange,
  disabled,
  dark,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative h-6 w-[42px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      style={{ backgroundColor: on ? '#16a34a' : dark ? '#4b4640' : '#d8cfbd' }}
    >
      <span
        className="absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-all duration-200"
        style={{ insetInlineStart: on ? 21 : 3 }}
      />
    </button>
  );
}

function RuleRow({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export interface GuardrailsInitial {
  automationEnabled: boolean;
  requireApprovalForSensitive: boolean;
  requireMessageReview: boolean;
  spendApprovalCapEnabled: boolean;
  spendApprovalCapSar: number;
}

const DARK_CARD = 'linear-gradient(135deg,#26221b,#1a1712)';

export function GuardrailsTab({
  initial,
  tokenBalance,
  plan,
  perAgentTokenCap,
  walletBalance,
  currency,
}: {
  initial: GuardrailsInitial;
  tokenBalance: number;
  plan: string;
  perAgentTokenCap: number; // 0 = unlimited
  walletBalance: number;
  currency: string;
}) {
  const [state, setState] = useState<GuardrailsInitial>(initial);
  const [capInput, setCapInput] = useState(String(initial.spendApprovalCapSar));
  const [, startTransition] = useTransition();
  const [running, startRun] = useTransition();

  function patch(p: GuardrailsPatch) {
    const before = state;
    setState((s) => ({ ...s, ...p })); // optimistic
    startTransition(async () => {
      const res = await updateGuardrails(p);
      if (!res.ok) setState(before); // revert on failure
    });
  }

  function commitCap() {
    const n = parseInt(capInput.replace(/[^\d]/g, ''), 10);
    const val = Number.isFinite(n) ? Math.min(1_000_000, Math.max(0, n)) : 0;
    setCapInput(String(val));
    if (val !== state.spendApprovalCapSar) patch({ spendApprovalCapSar: val });
  }

  function runNow() {
    startRun(async () => {
      const res = await runAutomationNow();
      if (res.ok) {
        toast.success(
          res.due === 0 ? 'No due work right now.' : `Ran ${res.ran} of ${res.due} due item(s).`
        );
      } else {
        toast.error(
          res.error === 'automation_paused' ? 'Automation is paused.' : 'Could not run automation.'
        );
      }
    });
  }

  const planLabel = PLAN_LABEL[plan] ?? plan;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Guardrails</h2>
        <p className="text-sm text-muted-foreground">
          The boundaries your AI workforce operates within — what they can decide alone, and
          what pauses for you.
        </p>
      </div>

      {/* Dark token-bank + wallet card. */}
      <div className="rounded-2xl p-5 text-[#efe9dd] shadow-sm" style={{ background: DARK_CARD }}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
              <Zap className="size-5 text-amber-400" />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/50">Token bank</div>
              <div className="text-lg font-semibold tabular-nums">
                {compact(tokenBalance)}{' '}
                <span className="text-sm font-normal text-white/60">tokens</span>
              </div>
              <div className="text-xs text-white/50">{planLabel} plan</div>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:justify-self-end">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
              <WalletIcon className="size-5 text-emerald-400" />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-white/50">Wallet</div>
              <div className="text-lg font-semibold tabular-nums">
                {walletBalance.toLocaleString('en')}{' '}
                <span className="text-sm font-normal text-white/60">{currency}</span>
              </div>
              <Link
                href="/wallet"
                className="inline-flex items-center gap-1 text-xs text-amber-300 hover:underline"
              >
                Top up <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Rule rows. */}
      <div className="divide-y rounded-2xl border bg-card">
        <RuleRow
          icon={ShieldCheck}
          title="Sensitive decisions need approval"
          desc="Agents pause and ask you before acting on a sensitive call (request_approval)."
        >
          <Toggle
            on={state.requireApprovalForSensitive}
            onChange={(v) => patch({ requireApprovalForSensitive: v })}
          />
        </RuleRow>

        <RuleRow
          icon={MessageSquareText}
          title="Customer-facing messages need review"
          desc="Drafts wait for your OK before they're sent to a customer."
        >
          <Toggle
            on={state.requireMessageReview}
            onChange={(v) => patch({ requireMessageReview: v })}
          />
        </RuleRow>

        <RuleRow
          icon={CircleDollarSign}
          title="Spend approval cap"
          desc="Money moves above this amount need your approval."
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-lg border bg-background ps-2 pe-2">
              <input
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                onBlur={commitCap}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                inputMode="numeric"
                aria-label="Spend approval cap"
                disabled={!state.spendApprovalCapEnabled}
                className="w-16 bg-transparent py-1.5 text-end tabular-nums outline-none disabled:opacity-50"
              />
              <span className="ps-1 text-xs text-muted-foreground">{currency}</span>
            </div>
            <Toggle
              on={state.spendApprovalCapEnabled}
              onChange={(v) => patch({ spendApprovalCapEnabled: v })}
            />
          </div>
        </RuleRow>

        <RuleRow
          icon={Gauge}
          title="Per-agent monthly token cap"
          desc="Set by your plan — keeps one agent from draining the shared bank."
        >
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums">
            {perAgentTokenCap === 0 ? 'Unlimited' : compact(perAgentTokenCap)}
          </span>
        </RuleRow>
      </div>

      {/* Scheduler & triggers master (dark). */}
      <div
        className="flex items-center justify-between gap-4 rounded-2xl p-5 text-[#efe9dd] shadow-sm"
        style={{ background: DARK_CARD }}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Clock
              className="size-5"
              style={{ color: state.automationEnabled ? '#34d399' : '#a8a29e' }}
            />
          </span>
          <div>
            <div className="font-semibold">Scheduler &amp; triggers</div>
            <div className="text-xs text-white/60">
              {state.automationEnabled
                ? 'Agents act on their schedules and event triggers.'
                : 'Paused — no agent runs until you switch this back on.'}
            </div>
          </div>
        </div>
        <Toggle
          on={state.automationEnabled}
          onChange={(v) => patch({ automationEnabled: v })}
          dark
        />
      </div>

      {/* Run automation now — fire the tenant's due schedules + pending autonomous
          tasks immediately instead of waiting for the minute cron. */}
      <button
        type="button"
        onClick={runNow}
        disabled={running || !state.automationEnabled}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {running ? 'Running…' : 'Run automation now'}
      </button>
      <p className="-mt-2 text-center text-xs text-muted-foreground">
        Runs due schedules + pending autonomous tasks for your workforce right now.
      </p>
    </div>
  );
}
