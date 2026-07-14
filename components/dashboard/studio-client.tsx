'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Play, Loader2, ChevronDown, CheckCircle2, XCircle, Cpu, Wrench, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StudioAgent {
  id: string;
  name: string;
  role: string;
  surface: string;
  model: string | null;
}

interface Trace {
  name: string;
  ok: boolean;
  args: Record<string, unknown>;
  result: string;
}
type RunResult =
  | { ok: true; reply: string; provider: string; model: string | null; tokensUsed: number; tools: Trace[]; availableCount: number }
  | { ok: false; reason: string };

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function StudioClient({ agents }: { agents: StudioAgent[] }) {
  const t = useTranslations('pages.studio');
  const locale = useLocale();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const agent = agents.find((a) => a.id === agentId);

  const run = async () => {
    if (!agentId || !message.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/sandbox`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });
      setResult((await res.json()) as RunResult);
    } catch {
      setResult({ ok: false, reason: 'network_error' });
    } finally {
      setRunning(false);
    }
  };

  if (agents.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{t('noAgents')}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Input */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>{t('pickAgent')}</Label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={selectCls}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.role}
                </option>
              ))}
            </select>
            {agent && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('rounded-full px-2 py-0.5', agent.surface === 'INTERNAL' ? 'bg-violet-500/10 text-violet-600' : 'bg-emerald-500/10 text-emerald-600')}>
                  {t(agent.surface === 'INTERNAL' ? 'surfaceInternal' : 'surfaceCustomer')}
                </span>
                {agent.model && <span className="inline-flex items-center gap-1"><Cpu className="size-3" />{agent.model}</span>}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('message')}</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder={t('messagePlaceholder')} />
            <p className="text-xs text-muted-foreground">{t('hint')}</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={run} disabled={running || !message.trim()} className="gap-1">
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? t('running') : t('run')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Output */}
      <Card>
        <CardContent className="space-y-4 p-5">
          {!result && <p className="py-12 text-center text-sm text-muted-foreground">{t('runToSee')}</p>}

          {result && !result.ok && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {t('failed', { reason: result.reason })}
            </p>
          )}

          {result && result.ok && (
            <>
              <div>
                <Label className="mb-1 block">{t('replyTitle')}</Label>
                <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{result.reply || '—'}</p>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Cpu className="size-3" />{result.provider}{result.model ? ` · ${result.model}` : ''}</span>
                <span className="inline-flex items-center gap-1"><Coins className="size-3" />{result.tokensUsed.toLocaleString(locale)} {t('tokens')}</span>
                <span className="inline-flex items-center gap-1"><Wrench className="size-3" />{t('toolsAvailable', { count: result.availableCount })}</span>
              </div>

              <div>
                <Label className="mb-1 block">{t('toolCalls')}</Label>
                {result.tools.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('noToolCalls')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {result.tools.map((tr, i) => (
                      <ToolTrace key={i} trace={tr} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ToolTrace({ trace }: { trace: Trace }) {
  const t = useTranslations('pages.studio');
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs">
        {trace.ok ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-destructive" />}
        <code className="font-medium">{trace.name}</code>
        <ChevronDown className={cn('ms-auto size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t px-3 py-2 text-[11px]">
          <div>
            <p className="mb-0.5 font-medium text-muted-foreground">{t('args')}</p>
            <pre className="overflow-x-auto rounded bg-muted p-2" dir="ltr">{JSON.stringify(trace.args, null, 2)}</pre>
          </div>
          <div>
            <p className="mb-0.5 font-medium text-muted-foreground">{t('result')}</p>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2" dir="ltr">{trace.result}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
