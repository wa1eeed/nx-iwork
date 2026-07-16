'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bot, Send, Sparkles, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Msg {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

// The hero's proof: a REAL conversation with a live demo agent (the dental demo
// tenant), streamed over the same public SSE endpoint customers use. Capped at a
// few visitor messages, then upsells signup. No mockup can compete with "try it".
const DEMO_SLUG = 'basma';
const MAX_MESSAGES = 3;

export function LiveAgentDemo() {
  const t = useTranslations('landing.demo');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [used, setUsed] = useState(0);
  const [visitorId, setVisitorId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id = sessionStorage.getItem('nx_demo_visitor');
    if (!id) {
      id = `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      sessionStorage.setItem('nx_demo_visitor', id);
    }
    setVisitorId(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const capped = used >= MAX_MESSAGES;

  async function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || sending || capped || !visitorId) return;
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    setSending(true);
    setUsed((n) => n + 1);

    const agentMsgId = `a${Date.now()}`;
    let acc = '';
    let started = false;
    const upsert = (content: string) =>
      setMessages((m) =>
        started
          ? m.map((msg) => (msg.id === agentMsgId ? { ...msg, content } : msg))
          : [...m, { id: agentMsgId, role: 'agent' as const, content }]
      );

    try {
      const res = await fetch(`/api/public/${DEMO_SLUG}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, visitorId }),
      });
      if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
        upsert(t('unavailable'));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          let evt: { type?: string; text?: string; reply?: string };
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (evt.type === 'delta' && evt.text) {
            acc += evt.text;
            upsert(acc);
            started = true;
          } else if (evt.type === 'done' && !started) {
            upsert(evt.reply || '…');
          } else if (evt.type === 'error' && !started) {
            upsert(t('unavailable'));
          }
        }
      }
      if (!started && !acc) upsert(t('unavailable'));
    } catch {
      if (!started) upsert(t('unavailable'));
    } finally {
      setSending(false);
    }
  }

  const promptKeys = ['p1', 'p2', 'p3'] as const;

  return (
    <div className="ring-gradient relative overflow-hidden rounded-3xl border bg-card/80 shadow-elevated backdrop-blur">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-gradient-brand-soft px-4 py-3">
        <span className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow">
          <Bot className="size-4" />
          <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t('agentName')}</p>
          <p className="truncate text-[11px] text-muted-foreground">{t('agentRole')}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 animate-glow-pulse rounded-full bg-emerald-500" />
          {t('liveBadge')}
        </span>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="h-72 space-y-3 overflow-y-auto p-4 sm:h-80">
        <div className="max-w-[85%] rounded-2xl rounded-ss-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
          {t('greeting')}
        </div>
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'rounded-se-md bg-gradient-brand text-white shadow-glow'
                  : 'rounded-ss-md bg-muted'
              )}
            >
              {m.role === 'agent' && !m.content ? null : (
                <div className="[&_p]:my-0.5 [&_strong]:font-semibold [&_ul]:ms-4 [&_li]:list-disc">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && messages[messages.length - 1]?.role !== 'agent' && (
          <div className="flex justify-start">
            <span className="flex items-center gap-1 rounded-2xl rounded-ss-md bg-muted px-3.5 py-3" role="status">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
            </span>
          </div>
        )}

        {/* After the cap: the upsell takes over the composer area */}
        {capped && !sending && (
          <div className="rounded-2xl border border-primary/25 bg-gradient-brand-soft p-4 text-center">
            <p className="text-sm font-semibold">{t('capTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('capBody')}</p>
            <Link
              href="/signup"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:opacity-90"
            >
              <Sparkles className="size-4" />
              {t('capCta')}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        )}
      </div>

      {/* Suggested prompts (until the visitor engages) */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {promptKeys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => send(t(`prompts.${k}`))}
              className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              {t(`prompts.${k}`)}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="flex items-center gap-2 border-t p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
          disabled={capped || sending}
          placeholder={capped ? t('capPlaceholder') : t('placeholder')}
          className="h-10 flex-1 rounded-xl border bg-background px-3.5 text-sm outline-none transition focus:border-primary/50 disabled:opacity-60"
          dir="auto"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={capped || sending || !input.trim()}
          aria-label={t('send')}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow transition hover:opacity-90 disabled:opacity-40"
        >
          <Send className="size-4 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}
