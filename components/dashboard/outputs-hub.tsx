'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import {
  FileText, ClipboardList, Megaphone, BarChart3, MessageSquare, Activity,
  Check, Send, Archive, RotateCcw, ChevronDown, ChevronUp, UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { setOutputStatus } from '@/lib/actions/outputs';
import type { AgentOutputStatus, AgentOutputType } from '@prisma/client';

export interface OutputItem {
  id: string;
  title: string;
  body: string;
  type: AgentOutputType;
  status: AgentOutputStatus;
  agentId: string;
  agentName: string;
  customerName: string | null;
  createdAt: string; // ISO
}

const TYPE_ICON: Record<AgentOutputType, typeof FileText> = {
  MESSAGE: MessageSquare,
  REPORT: FileText,
  PLAN: ClipboardList,
  CONTENT: Megaphone,
  ANALYSIS: BarChart3,
  ACTION_LOG: Activity,
};

const STATUS_STYLE: Record<AgentOutputStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  READY: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  APPROVED: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  ARCHIVED: 'bg-muted text-muted-foreground line-through',
};

// Which review actions are offered for each status (the deliverable's lifecycle).
const NEXT: Record<AgentOutputStatus, Array<{ to: AgentOutputStatus; key: 'approve' | 'publish' | 'archive' | 'markReady' | 'restore'; icon: typeof Check }>> = {
  DRAFT: [{ to: 'READY', key: 'markReady', icon: Check }, { to: 'ARCHIVED', key: 'archive', icon: Archive }],
  READY: [{ to: 'APPROVED', key: 'approve', icon: Check }, { to: 'ARCHIVED', key: 'archive', icon: Archive }],
  APPROVED: [{ to: 'PUBLISHED', key: 'publish', icon: Send }, { to: 'ARCHIVED', key: 'archive', icon: Archive }],
  PUBLISHED: [{ to: 'ARCHIVED', key: 'archive', icon: Archive }],
  ARCHIVED: [{ to: 'READY', key: 'restore', icon: RotateCcw }],
};

export function OutputsHub({ items, agents }: { items: OutputItem[]; agents: Array<{ id: string; name: string }> }) {
  const t = useTranslations('outputs');
  const locale = useLocale();
  const [typeF, setTypeF] = useState<'all' | AgentOutputType>('all');
  const [statusF, setStatusF] = useState<'all' | AgentOutputStatus>('all');
  const [agentF, setAgentF] = useState<'all' | string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const filtered = items.filter(
    (o) =>
      (typeF === 'all' || o.type === typeF) &&
      (statusF === 'all' || o.status === statusF) &&
      (agentF === 'all' || o.agentId === agentF),
  );

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function act(id: string, to: AgentOutputStatus) {
    setBusyId(id);
    start(async () => {
      await setOutputStatus({ id, status: to });
      setBusyId(null);
    });
  }

  const selectCls =
    'rounded-lg border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select className={selectCls} value={typeF} onChange={(e) => setTypeF(e.target.value as typeof typeF)}>
          <option value="all">{t('allTypes')}</option>
          {(['REPORT', 'PLAN', 'CONTENT', 'ANALYSIS', 'MESSAGE', 'ACTION_LOG'] as AgentOutputType[]).map((ty) => (
            <option key={ty} value={ty}>{t(`type.${ty}`)}</option>
          ))}
        </select>
        <select className={selectCls} value={statusF} onChange={(e) => setStatusF(e.target.value as typeof statusF)}>
          <option value="all">{t('allStatus')}</option>
          {(['READY', 'APPROVED', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as AgentOutputStatus[]).map((st) => (
            <option key={st} value={st}>{t(`status.${st}`)}</option>
          ))}
        </select>
        {agents.length > 1 && (
          <select className={selectCls} value={agentF} onChange={(e) => setAgentF(e.target.value)}>
            <option value="all">{t('allAgents')}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {items.length === 0 ? t('empty') : t('emptyFiltered')}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const Icon = TYPE_ICON[o.type];
            const isOpen = expanded.has(o.id);
            const busy = busyId === o.id && pending;
            return (
              <div key={o.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/70">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_STYLE[o.status])}>
                        {t(`status.${o.status}`)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {t(`type.${o.type}`)}
                      </span>
                      <p className="font-semibold">{o.title}</p>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{t('by', { agent: o.agentName })}</span>
                      <span>·</span>
                      <span className="tabular-nums">{dateFmt.format(new Date(o.createdAt))}</span>
                      {o.customerName && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="size-3" />
                            {t('linkedTo', { customer: o.customerName })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(o.id)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:bg-accent"
                  >
                    {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    {isOpen ? t('hide') : t('view')}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm leading-relaxed [&_a]:underline [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:ps-5">
                    <ReactMarkdown>{o.body}</ReactMarkdown>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {NEXT[o.status].map(({ to, key, icon: AIcon }) => (
                    <button
                      key={key}
                      disabled={busy}
                      onClick={() => act(o.id, to)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
                        key === 'archive'
                          ? 'border text-muted-foreground hover:bg-accent'
                          : 'bg-foreground text-background hover:opacity-90',
                      )}
                    >
                      <AIcon className="size-3.5" />
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
