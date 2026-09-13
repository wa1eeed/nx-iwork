'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { Radar, Send, Mic, Bot, Crown, Sparkles, Loader2, Radio, Bell, Activity } from 'lucide-react';
import type { CommandState, CommandAgent } from '@/lib/command/state';

// ── The Command Center ──────────────────────────────────────────────────────
// A neon "cockpit": a live radar of the AI workforce orbiting the Maestro (the
// conductor), beside a chat/voice console that commands it. The Maestro builds
// and configures the other agents from the conversation — so the owner directs a
// team instead of filling in forms. Deliberately dark + glowing (a "screen"),
// independent of the app's light theme tokens.

type Locale = 'en' | 'ar';

interface Props {
  initial: CommandState;
  conductorId: string;
  locale: Locale;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

const STATUS_META: Record<
  string,
  { color: string; pulse: boolean; label: { ar: string; en: string } }
> = {
  ONLINE: { color: '#22d3ee', pulse: false, label: { ar: 'نشِط', en: 'Online' } },
  WORKING: { color: '#fbbf24', pulse: true, label: { ar: 'يعمل الآن', en: 'Working' } },
  ONBOARDING: { color: '#a855f7', pulse: true, label: { ar: 'تهيئة', en: 'Onboarding' } },
  PAUSED: { color: '#64748b', pulse: false, label: { ar: 'متوقف', en: 'Paused' } },
  OFFLINE: { color: '#475569', pulse: false, label: { ar: 'غير متصل', en: 'Offline' } },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.OFFLINE;
}

// Colour per timeline-event family, for the live activity feed dots.
function eventColor(type: string): string {
  if (type.includes('COMPLETED') || type === 'OUTPUT_DELIVERED') return '#34d399';
  if (type.includes('FAILED') || type === 'SYSTEM_ALERT') return '#f87171';
  if (type.includes('APPROVAL') || type === 'DECISION_NEEDED') return '#a855f7';
  if (type.includes('STARTED') || type === 'AGENT_WOKE' || type === 'AGENT_HANDOFF') return '#fbbf24';
  return '#22d3ee';
}

function timeAgo(iso: string, en: boolean): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return en ? 'now' : 'الآن';
  const m = Math.round(s / 60);
  if (m < 60) return en ? `${m}m` : `${m} د`;
  const h = Math.round(m / 60);
  if (h < 24) return en ? `${h}h` : `${h} س`;
  const d = Math.round(h / 24);
  return en ? `${d}d` : `${d} ي`;
}

interface Placed extends CommandAgent {
  x: number;
  y: number;
}

// Distribute a list of agents evenly around a ring centred on (50,50).
function ring(list: CommandAgent[], radius: number, offset = 0): Placed[] {
  const n = Math.max(list.length, 1);
  return list.map((a, i) => {
    const angle = ((-90 + offset + (360 / n) * i) * Math.PI) / 180;
    return { ...a, x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
  });
}

export function CommandCenter({ initial, conductorId, locale }: Props) {
  const en = locale === 'en';
  const dir = en ? 'ltr' : 'rtl';
  const [state, setState] = useState<CommandState>(initial);
  const [activeId, setActiveId] = useState<string>(conductorId);
  const [threads, setThreads] = useState<Record<string, ChatMsg[]>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<unknown>(null);

  const conductor = state.agents.find((a) => a.isConductor) ?? null;
  const others = state.agents.filter((a) => !a.isConductor);
  const activeAgent = state.agents.find((a) => a.id === activeId) ?? conductor;

  // ── Live polling ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/command/state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as CommandState & { ok: boolean };
      if (data.ok) {
        setState({
          conductorId: data.conductorId,
          stats: data.stats,
          pendingApprovals: data.pendingApprovals,
          agents: data.agents,
          activity: data.activity,
        });
      }
    } catch {
      /* transient — the next tick retries */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const messages = threads[activeId] ?? [];
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ── Radar placement ─────────────────────────────────────────────────────────
  const placed = useMemo(() => {
    const internal = others.filter((a) => a.scope === 'internal');
    const customer = others.filter((a) => a.scope === 'customer');
    // Inner ring = internal (operations, close to the conductor); outer = customer.
    return [...ring(internal, 27), ...ring(customer, 42, 18)];
  }, [others]);

  // ── Chat (SSE) ───────────────────────────────────────────────────────────
  async function send(text?: string) {
    const body = (text ?? input).trim();
    if (!body || sending) return;
    const targetId = activeId;
    const uId = `u-${Date.now()}`;
    const aId = `a-${Date.now()}`;
    const setAgent = (content: string) =>
      setThreads((t) => ({
        ...t,
        [targetId]: (t[targetId] ?? []).map((m) => (m.id === aId ? { ...m, content } : m)),
      }));

    setThreads((t) => ({
      ...t,
      [targetId]: [...(t[targetId] ?? []), { id: uId, role: 'user', content: body }, { id: aId, role: 'agent', content: '' }],
    }));
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/agents/${targetId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: body }),
      });
      if (!res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
        const data = await res.json().catch(() => null);
        setAgent(data?.message || (en ? 'Could not reach the agent right now.' : 'تعذّر الوصول للوكيل الآن.'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const ev of events) {
          const line = ev.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          let payload: { type: string; text?: string; reply?: string; message?: string };
          try {
            payload = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (payload.type === 'delta') {
            acc += payload.text ?? '';
            setAgent(acc);
          } else if (payload.type === 'done') {
            setAgent(payload.reply ?? acc);
          } else if (payload.type === 'error') {
            setAgent(payload.message || (en ? 'Something went wrong.' : 'حدث خطأ ما.'));
          }
        }
      }
    } catch {
      setAgent(en ? 'Connection failed.' : 'فشل الاتصال.');
    } finally {
      setSending(false);
      // A build/configure command may have changed the fleet — refresh the radar.
      refresh();
    }
  }

  // ── Voice dictation (Web Speech API — browser-native, no backend) ──────────
  const voiceSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  function toggleVoice() {
    if (!voiceSupported) return;
    if (listening) {
      (recRef.current as { stop?: () => void } | null)?.stop?.();
      setListening(false);
      return;
    }
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor() as {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
      stop: () => void;
    };
    rec.lang = en ? 'en-US' : 'ar-SA';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  const talkingToConductor = activeAgent?.isConductor ?? true;
  const quickPrompts = talkingToConductor
    ? en
      ? [
          'Build a real-estate sales agent and grant it sales permissions',
          'Who registered today?',
          'Show me the whole team',
          'Create an internal marketing agent',
        ]
      : [
          'ابنِ لي وكيل مبيعات عقارات وامنحه صلاحيات المبيعات',
          'مين سجّل اليوم؟',
          'اعرض لي كل الفريق',
          'أنشئ وكيل تسويق داخلي',
        ]
    : [];

  return (
    <div
      dir={dir}
      className="cc-root relative overflow-hidden rounded-3xl border border-cyan-400/15 text-slate-100"
    >
      <style>{CC_KEYFRAMES}</style>

      {/* Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="cc-badge flex size-11 items-center justify-center rounded-2xl">
            <Radar className="size-5 text-cyan-300" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">
              {en ? 'Command Center' : 'مركز القيادة'}
            </h1>
            <p className="text-xs text-cyan-200/60">
              {en ? 'Direct your AI workforce from one place' : 'قُد فريق وكلائك الأذكياء من مكان واحد'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {state.pendingApprovals > 0 && (
            <Link
              href="/approvals"
              className="flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-violet-100 transition hover:bg-violet-500/25"
            >
              <Bell className="size-3.5 text-violet-300" />
              <span className="font-semibold">{state.pendingApprovals}</span>
              <span className="text-violet-200/80">{en ? 'need you' : 'تنتظر قرارك'}</span>
            </Link>
          )}
          <StatPill color="#22d3ee" label={en ? 'Online' : 'نشِط'} value={state.stats.online} />
          <StatPill color="#fbbf24" label={en ? 'Working' : 'في مهمة'} value={state.stats.working} />
          <StatPill color="#64748b" label={en ? 'Idle' : 'متوقف'} value={state.stats.paused} />
        </div>
      </div>

      <div className="relative z-10 grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Radar */}
        <section className="cc-panel relative rounded-2xl p-3 sm:p-5">
          <div className="relative mx-auto aspect-square w-full max-w-[520px]">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
              <defs>
                <radialGradient id="cc-sweep" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
                  <stop offset="55%" stopColor="#22d3ee" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="cc-core" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="60%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </radialGradient>
              </defs>

              {/* Rings + grid */}
              {[46, 36, 26, 15].map((r) => (
                <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#22d3ee" strokeOpacity="0.1" strokeWidth="0.3" />
              ))}
              <line x1="4" y1="50" x2="96" y2="50" stroke="#22d3ee" strokeOpacity="0.08" strokeWidth="0.3" />
              <line x1="50" y1="4" x2="50" y2="96" stroke="#22d3ee" strokeOpacity="0.08" strokeWidth="0.3" />

              {/* Connection spokes (brighten + animate for working agents) */}
              {placed.map((a) => {
                const working = a.status === 'WORKING';
                return (
                  <line
                    key={`l-${a.id}`}
                    x1="50"
                    y1="50"
                    x2={a.x}
                    y2={a.y}
                    stroke={working ? '#fbbf24' : '#22d3ee'}
                    strokeOpacity={working ? 0.6 : 0.18}
                    strokeWidth={working ? 0.5 : 0.3}
                    strokeDasharray={working ? '1.5 1.5' : undefined}
                    className={working ? 'cc-dash' : undefined}
                  />
                );
              })}

              {/* Rotating sweep */}
              <g className="cc-sweep" style={{ transformOrigin: '50px 50px' }}>
                <path d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z" fill="url(#cc-sweep)" />
              </g>

              {/* Maestro core glow */}
              <circle cx="50" cy="50" r="9" fill="url(#cc-core)" />
              <circle cx="50" cy="50" r="9" fill="none" stroke="#67e8f9" strokeOpacity="0.5" strokeWidth="0.4" className="cc-ping" />
            </svg>

            {/* Center node — the Maestro */}
            <NodeButton
              x={50}
              y={50}
              center
              active={activeId === conductorId}
              onClick={() => conductor && setActiveId(conductor.id)}
              label={conductor?.name ?? (en ? 'Maestro' : 'المايسترو')}
              sub={en ? 'Chief of Staff' : 'المدير الأساسي'}
              color="#67e8f9"
              icon={<Crown className="size-4 text-slate-900" />}
              pulse
            />

            {/* Agent nodes */}
            {placed.map((a) => {
              const m = statusMeta(a.status);
              return (
                <NodeButton
                  key={a.id}
                  x={a.x}
                  y={a.y}
                  active={activeId === a.id}
                  onClick={() => setActiveId(a.id)}
                  label={a.name}
                  sub={a.status === 'WORKING' && a.activity ? a.activity : (en ? (a.roleEn ?? a.role) : a.role)}
                  color={m.color}
                  pulse={m.pulse}
                  initial={a.initial}
                />
              );
            })}

            {others.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] text-cyan-200/50">
                {en ? 'Ask the Maestro to build your first agent →' : '← اطلب من المايسترو بناء أول وكيل لك'}
              </div>
            )}
          </div>
        </section>

        {/* Console */}
        <section className="cc-panel flex min-h-[420px] flex-col rounded-2xl lg:h-[560px]">
          {/* Who am I talking to */}
          <header className="flex items-center gap-3 border-b border-cyan-400/10 p-3">
            <span
              className="flex size-9 items-center justify-center rounded-xl text-sm font-bold"
              style={{ background: talkingToConductor ? 'linear-gradient(135deg,#22d3ee,#7c3aed)' : 'rgba(34,211,238,0.15)', color: talkingToConductor ? '#04121a' : '#67e8f9' }}
            >
              {talkingToConductor ? <Radio className="size-4" /> : activeAgent?.initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{activeAgent?.name}</p>
              <p className="truncate text-xs text-cyan-200/50">
                {talkingToConductor
                  ? en
                    ? 'Talk to the Maestro — it builds & directs the team'
                    : 'حادِث المايسترو — يبني ويدير الفريق'
                  : en
                    ? (activeAgent?.roleEn ?? activeAgent?.role)
                    : activeAgent?.role}
              </p>
            </div>
            {!talkingToConductor && conductor && (
              <button
                onClick={() => setActiveId(conductor.id)}
                className="rounded-lg border border-cyan-400/20 px-2.5 py-1 text-[11px] text-cyan-200/80 transition hover:bg-cyan-400/10"
              >
                {en ? 'Back to Maestro' : 'العودة للمايسترو'}
              </button>
            )}
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="pt-6 text-center">
                <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-cyan-400/10">
                  {talkingToConductor ? <Sparkles className="size-6 text-cyan-300" /> : <Bot className="size-6 text-cyan-300" />}
                </span>
                <p className="text-sm text-slate-300">
                  {talkingToConductor
                    ? en
                      ? 'Tell the Maestro what you need — it will build the right agent and give it the right permissions.'
                      : 'أخبر المايسترو بما تحتاجه — سيبني الوكيل المناسب ويمنحه الصلاحيات الصحيحة.'
                    : en
                      ? `Chat with ${activeAgent?.name} directly.`
                      : `حادِث ${activeAgent?.name} مباشرة.`}
                </p>
              </div>
            )}
            {messages.map((mm) => (
              <div key={mm.id} className={mm.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    mm.role === 'user'
                      ? 'max-w-[85%] rounded-2xl bg-cyan-500/90 px-3.5 py-2 text-sm leading-relaxed text-slate-950'
                      : 'cc-bubble max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed text-slate-100'
                  }
                >
                  {mm.role === 'agent' && !mm.content ? (
                    <Loader2 className="size-4 animate-spin text-cyan-300" />
                  ) : mm.role === 'agent' ? (
                    <div className="cc-md space-y-2">
                      <ReactMarkdown>{mm.content}</ReactMarkdown>
                    </div>
                  ) : (
                    mm.content
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick prompts */}
          {messages.length === 0 && quickPrompts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1 text-[11px] text-cyan-100/80 transition hover:bg-cyan-400/15"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-cyan-400/10 p-3">
            {voiceSupported && (
              <button
                onClick={toggleVoice}
                aria-label={en ? 'Voice input' : 'إدخال صوتي'}
                className={
                  listening
                    ? 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/90 text-white'
                    : 'flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 text-cyan-200/80 transition hover:bg-cyan-400/10'
                }
              >
                <Mic className={listening ? 'size-4 animate-pulse' : 'size-4'} />
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder={
                listening
                  ? en ? 'Listening…' : 'أستمع…'
                  : talkingToConductor
                    ? en ? 'Command the Maestro…' : 'أعطِ المايسترو أمراً…'
                    : en ? 'Type a message…' : 'اكتب رسالة…'
              }
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-cyan-400/15 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/40 focus:outline-none"
            />
            <button
              onClick={() => send()}
              disabled={sending || !input.trim()}
              aria-label={en ? 'Send' : 'إرسال'}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-slate-950 transition disabled:opacity-40"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </div>
        </section>
      </div>

      {/* Live activity feed — the real pulse of the workforce */}
      <div className="relative z-10 px-4 pb-5 sm:px-6">
        <div className="cc-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="size-4 text-cyan-300" />
            <h2 className="text-sm font-semibold">{en ? 'Live activity' : 'النشاط الحيّ'}</h2>
          </div>
          {state.activity.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              {en ? 'No activity yet — put your agents to work.' : 'لا نشاط بعد — شغّل وكلاءك.'}
            </p>
          ) : (
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {state.activity.map((e) => (
                <li key={e.id} className="flex items-center gap-2.5 text-xs">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: eventColor(e.type), boxShadow: `0 0 6px ${eventColor(e.type)}` }} />
                  <span className="min-w-0 flex-1 truncate text-slate-200">{e.title}</span>
                  {e.agentName && <span className="shrink-0 text-cyan-200/60">{e.agentName}</span>}
                  <span className="shrink-0 tabular-nums text-slate-500">{timeAgo(e.at, en)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
      <span className="size-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
      <span className="font-semibold">{value}</span>
      <span className="text-slate-400">{label}</span>
    </span>
  );
}

function NodeButton({
  x,
  y,
  onClick,
  label,
  sub,
  color,
  icon,
  initial,
  active,
  center,
  pulse,
}: {
  x: number;
  y: number;
  onClick: () => void;
  label: string;
  sub?: string;
  color: string;
  icon?: React.ReactNode;
  initial?: string;
  active?: boolean;
  center?: boolean;
  pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className={
          (center ? 'size-11 ' : 'size-8 ') +
          'relative flex items-center justify-center rounded-full font-bold transition group-hover:scale-110'
        }
        style={{
          background: center ? 'linear-gradient(135deg,#22d3ee,#7c3aed)' : 'rgba(15,23,42,0.85)',
          border: `${active ? 2 : 1.5}px solid ${color}`,
          boxShadow: active ? `0 0 20px ${color}, 0 0 6px ${color} inset` : `0 0 10px ${color}aa`,
          color: center ? '#04121a' : color,
        }}
      >
        {pulse && (
          <span
            className="cc-ping absolute inset-0 rounded-full"
            style={{ border: `1.5px solid ${color}` }}
          />
        )}
        {icon ?? <span className="text-[11px]">{initial}</span>}
      </span>
      <span className="pointer-events-none max-w-[84px] text-center">
        <span className="block truncate text-[10px] font-semibold leading-tight text-slate-100">{label}</span>
        {sub && (
          <span className="block truncate text-[9px] leading-tight text-slate-400 group-hover:text-cyan-200/70">
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

const CC_KEYFRAMES = `
.cc-root {
  background:
    radial-gradient(120% 90% at 50% -10%, rgba(34,211,238,0.10), transparent 60%),
    radial-gradient(90% 80% at 100% 110%, rgba(124,58,237,0.14), transparent 55%),
    linear-gradient(160deg, #060a16 0%, #081124 55%, #0a0f22 100%);
  box-shadow: inset 0 0 0 1px rgba(34,211,238,0.06), 0 30px 80px -40px rgba(34,211,238,0.35);
}
.cc-panel {
  background: linear-gradient(180deg, rgba(9,17,34,0.7), rgba(6,10,22,0.55));
  border: 1px solid rgba(34,211,238,0.12);
  backdrop-filter: blur(6px);
}
.cc-badge {
  background: linear-gradient(135deg, rgba(34,211,238,0.18), rgba(124,58,237,0.22));
  border: 1px solid rgba(34,211,238,0.25);
  box-shadow: 0 0 20px -4px rgba(34,211,238,0.5);
}
.cc-bubble { background: rgba(34,211,238,0.08); border: 1px solid rgba(34,211,238,0.14); }
.cc-md :is(ul,ol) { padding-inline-start: 1.1rem; list-style: disc; }
.cc-md ol { list-style: decimal; }
.cc-md strong { color: #a5f3fc; }
.cc-md a { color: #67e8f9; text-decoration: underline; }
.cc-md code { background: rgba(34,211,238,0.12); padding: 0 .25rem; border-radius: .25rem; }
@keyframes cc-spin { to { transform: rotate(360deg); } }
.cc-sweep { animation: cc-spin 5s linear infinite; }
@keyframes cc-ping { 0% { transform: scale(1); opacity: .7; } 80%,100% { transform: scale(1.9); opacity: 0; } }
.cc-ping { animation: cc-ping 2.4s ease-out infinite; }
@keyframes cc-dash { to { stroke-dashoffset: -6; } }
.cc-dash { animation: cc-dash 0.8s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .cc-sweep, .cc-ping, .cc-dash { animation: none; }
}
`;
