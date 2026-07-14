'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send, CheckCircle2, Loader2, Plug, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { connectTelegram, setTelegramAgent, disconnectTelegram } from '@/lib/actions/channels';

export interface ChannelsState {
  connected: boolean;
  botUsername: string | null;
  agentId: string | null;
  isActive: boolean;
}

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function ChannelsTab({
  initial,
  agents,
}: {
  initial: ChannelsState;
  agents: { id: string; name: string }[];
}) {
  const t = useTranslations('settings');
  const tc = useTranslations('settings.channels');
  const router = useRouter();
  const confirm = useConfirm();

  const [token, setToken] = useState('');
  const [agentId, setAgentId] = useState(initial.agentId ?? agents[0]?.id ?? '');
  const [connecting, startConnect] = useTransition();
  const [savingAgent, startAgent] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();

  const errMsg = (code: string) => {
    const known = ['token_required', 'agent_invalid', 'https_required', 'invalid_token', 'webhook_failed', 'not_connected'];
    return known.includes(code) ? tc(`err.${code}`) : t('saveError');
  };

  const connect = () => {
    startConnect(async () => {
      const res = await connectTelegram({ token, agentId });
      if (res.ok) {
        toast.success(tc('connected', { bot: res.botUsername ? `@${res.botUsername}` : '' }));
        setToken('');
        router.refresh();
      } else {
        toast.error(errMsg(res.error));
      }
    });
  };

  const changeAgent = (id: string) => {
    setAgentId(id);
    if (!initial.connected) return;
    startAgent(async () => {
      const res = await setTelegramAgent(id);
      if (res.ok) toast.success(t('saved'));
      else toast.error(errMsg(res.error));
    });
  };

  const disconnect = () => {
    startDisconnect(async () => {
      const okConfirm = await confirm({
        title: tc('disconnect'),
        description: tc('disconnectConfirm'),
        confirmLabel: tc('disconnect'),
        destructive: true,
      });
      if (!okConfirm) return;
      const res = await disconnectTelegram();
      if (res.ok) {
        toast.success(tc('disconnected'));
        router.refresh();
      } else {
        toast.error(errMsg(res.error));
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Send className="h-5 w-5 text-primary" />
          {tc('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">{tc('subtitle')}</p>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {tc('noAgents')}
          </div>
        ) : (
          <>
            {/* Connection status */}
            {initial.connected && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={initial.isActive ? 'size-5 text-emerald-500' : 'size-5 text-amber-500'} />
                  <div>
                    <p className="font-medium">
                      {initial.botUsername ? `@${initial.botUsername}` : tc('title')}
                      {' · '}
                      <span className={initial.isActive ? 'text-emerald-600' : 'text-amber-600'}>
                        {initial.isActive ? tc('statusActive') : tc('statusInactive')}
                      </span>
                    </p>
                    {!initial.isActive && <p className="text-xs text-muted-foreground">{tc('reconnectHint')}</p>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={disconnect} disabled={disconnecting} className="gap-1 text-destructive hover:text-destructive">
                  {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                  {tc('disconnect')}
                </Button>
              </div>
            )}

            {/* Agent picker (which agent answers on Telegram) */}
            <div className="space-y-2">
              <Label>{tc('agent')}</Label>
              <select value={agentId} onChange={(e) => changeAgent(e.target.value)} className={selectCls} disabled={savingAgent}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{tc('agentHelp')}</p>
            </div>

            {/* Token entry (connect / reconnect) */}
            <div className="space-y-2">
              <Label>{initial.connected ? tc('reconnect') : tc('botToken')}</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                dir="ltr"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">{tc('botTokenHelp')}</p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">{tc('howTitle')}</p>
              <ol className="mt-1 list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
                <li>{tc('how1')}</li>
                <li>{tc('how2')}</li>
                <li>{tc('how3')}</li>
              </ol>
            </div>

            <div className="flex justify-end">
              <Button onClick={connect} disabled={connecting || !token.trim() || !agentId} className="gap-1">
                {connecting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
                {initial.connected ? tc('reconnect') : tc('connect')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
