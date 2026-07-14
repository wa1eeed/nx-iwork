'use client';

import { useState, useTransition, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send, MessageCircle, CheckCircle2, Loader2, Plug, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { WhatsAppEmbeddedSignup } from '@/components/settings/whatsapp-embedded-signup';
import {
  connectTelegram,
  setTelegramAgent,
  disconnectTelegram,
  connectWhatsApp,
  setWhatsAppAgent,
  disconnectWhatsApp,
} from '@/lib/actions/channels';

export interface ChannelState {
  connected: boolean;
  label: string | null; // @username (Telegram) or display number/name (WhatsApp)
  agentId: string | null;
  isActive: boolean;
}

type Agent = { id: string; name: string };

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const KNOWN_ERR = ['token_required', 'agent_invalid', 'https_required', 'invalid_token', 'webhook_failed', 'not_connected', 'phone_in_use'];

export function ChannelsTab({
  telegram,
  whatsapp,
  agents,
}: {
  telegram: ChannelState;
  whatsapp: ChannelState;
  agents: Agent[];
}) {
  const tc = useTranslations('settings.channels');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{tc('subtitle')}</p>
      {agents.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">{tc('noAgents')}</CardContent>
        </Card>
      ) : (
        <>
          <TelegramCard initial={telegram} agents={agents} />
          <WhatsAppCard initial={whatsapp} agents={agents} />
        </>
      )}
    </div>
  );
}

// Shared bits ------------------------------------------------------------------
function useErr() {
  const tc = useTranslations('settings.channels');
  const t = useTranslations('settings');
  return (code: string) => (KNOWN_ERR.includes(code) ? tc(`err.${code}`) : t('saveError'));
}

function StatusRow({
  label,
  isActive,
  onDisconnect,
  disconnecting,
}: {
  label: string | null;
  isActive: boolean;
  onDisconnect: () => void;
  disconnecting: boolean;
}) {
  const tc = useTranslations('settings.channels');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className={isActive ? 'size-5 text-emerald-500' : 'size-5 text-amber-500'} />
        <p className="font-medium">
          {label || '—'}
          {' · '}
          <span className={isActive ? 'text-emerald-600' : 'text-amber-600'}>
            {isActive ? tc('statusActive') : tc('statusInactive')}
          </span>
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onDisconnect} disabled={disconnecting} className="gap-1 text-destructive hover:text-destructive">
        {disconnecting ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
        {tc('disconnect')}
      </Button>
    </div>
  );
}

function AgentSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const tc = useTranslations('settings.channels');
  const agents = useAgents();
  return (
    <div className="space-y-2">
      <Label>{tc('agent')}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls} disabled={disabled}>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">{tc('agentHelp')}</p>
    </div>
  );
}

// Tiny context so AgentSelect can read the shared agents list.
const AgentsCtx = createContext<Agent[]>([]);
function useAgents() {
  return useContext(AgentsCtx);
}

// Telegram ---------------------------------------------------------------------
function TelegramCard({ initial, agents }: { initial: ChannelState; agents: Agent[] }) {
  const tc = useTranslations('settings.channels');
  const tt = useTranslations('settings.channels.telegram');
  const t = useTranslations('settings');
  const router = useRouter();
  const confirm = useConfirm();
  const errMsg = useErr();

  const [token, setToken] = useState('');
  const [agentId, setAgentId] = useState(initial.agentId ?? agents[0]?.id ?? '');
  const [connecting, startConnect] = useTransition();
  const [savingAgent, startAgent] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();

  const connect = () =>
    startConnect(async () => {
      const res = await connectTelegram({ token, agentId });
      if (res.ok) {
        toast.success(tc('connected', { bot: res.botUsername ? `@${res.botUsername}` : '' }));
        setToken('');
        router.refresh();
      } else toast.error(errMsg(res.error));
    });

  const changeAgent = (id: string) => {
    setAgentId(id);
    if (!initial.connected) return;
    startAgent(async () => {
      const res = await setTelegramAgent(id);
      if (res.ok) toast.success(t('saved'));
      else toast.error(errMsg(res.error));
    });
  };

  const disconnect = () =>
    startDisconnect(async () => {
      if (!(await confirm({ title: tc('disconnect'), description: tc('disconnectConfirm'), confirmLabel: tc('disconnect'), destructive: true }))) return;
      const res = await disconnectTelegram();
      if (res.ok) {
        toast.success(tc('disconnected'));
        router.refresh();
      } else toast.error(errMsg(res.error));
    });

  return (
    <AgentsCtx.Provider value={agents}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-primary" />
            {tt('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {initial.connected && <StatusRow label={initial.label} isActive={initial.isActive} onDisconnect={disconnect} disconnecting={disconnecting} />}
          <AgentSelect value={agentId} onChange={changeAgent} disabled={savingAgent} />
          <div className="space-y-2">
            <Label>{initial.connected ? tc('reconnect') : tt('botToken')}</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-DEF..." dir="ltr" className="font-mono" />
            <p className="text-xs text-muted-foreground">{tt('botTokenHelp')}</p>
          </div>
          <HowTo title={tt('howTitle')} steps={[tt('how1'), tt('how2'), tt('how3')]} />
          <div className="flex justify-end">
            <Button onClick={connect} disabled={connecting || !token.trim() || !agentId} className="gap-1">
              {connecting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              {initial.connected ? tc('reconnect') : tc('connect')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AgentsCtx.Provider>
  );
}

// WhatsApp ---------------------------------------------------------------------
function WhatsAppCard({ initial, agents }: { initial: ChannelState; agents: Agent[] }) {
  const tc = useTranslations('settings.channels');
  const tw = useTranslations('settings.channels.whatsapp');
  const t = useTranslations('settings');
  const router = useRouter();
  const confirm = useConfirm();
  const errMsg = useErr();

  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [agentId, setAgentId] = useState(initial.agentId ?? agents[0]?.id ?? '');
  const [connecting, startConnect] = useTransition();
  const [savingAgent, startAgent] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();

  const connect = () =>
    startConnect(async () => {
      const res = await connectWhatsApp({ accessToken, phoneNumberId, agentId });
      if (res.ok) {
        toast.success(tc('connected', { bot: res.botUsername ?? '' }));
        setAccessToken('');
        router.refresh();
      } else toast.error(errMsg(res.error));
    });

  const changeAgent = (id: string) => {
    setAgentId(id);
    if (!initial.connected) return;
    startAgent(async () => {
      const res = await setWhatsAppAgent(id);
      if (res.ok) toast.success(t('saved'));
      else toast.error(errMsg(res.error));
    });
  };

  const disconnect = () =>
    startDisconnect(async () => {
      if (!(await confirm({ title: tc('disconnect'), description: tc('disconnectConfirm'), confirmLabel: tc('disconnect'), destructive: true }))) return;
      const res = await disconnectWhatsApp();
      if (res.ok) {
        toast.success(tc('disconnected'));
        router.refresh();
      } else toast.error(errMsg(res.error));
    });

  return (
    <AgentsCtx.Provider value={agents}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            {tw('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {initial.connected && <StatusRow label={initial.label} isActive={initial.isActive} onDisconnect={disconnect} disconnecting={disconnecting} />}
          <AgentSelect value={agentId} onChange={changeAgent} disabled={savingAgent} />
          {/* One-click Embedded Signup (renders only when configured); otherwise
              the manual fields below are the connection path. */}
          <WhatsAppEmbeddedSignup agentId={agentId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{tw('phoneNumberId')}</Label>
              <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="1029384756..." dir="ltr" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>{initial.connected ? tc('reconnect') : tw('accessToken')}</Label>
              <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAG..." dir="ltr" className="font-mono" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{tw('tokenHelp')}</p>
          <HowTo title={tw('howTitle')} steps={[tw('how1'), tw('how2'), tw('how3')]} note={tw('advancedNote')} />
          <div className="flex justify-end">
            <Button onClick={connect} disabled={connecting || !accessToken.trim() || !phoneNumberId.trim() || !agentId} className="gap-1">
              {connecting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              {initial.connected ? tc('reconnect') : tc('connect')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AgentsCtx.Provider>
  );
}

function HowTo({ title, steps, note }: { title: string; steps: string[]; note?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-medium">{title}</p>
      <ol className="mt-1 list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      {note && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{note}</p>}
    </div>
  );
}
