'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Msg {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

// Floating customer-service chat for the public landing page. Talks to
// /api/public/[slug]/chat. Visitor identity is a random id kept in localStorage.
export function ChatWidget({
  slug,
  agentName,
  greeting,
  primaryColor,
  position,
  whatsapp,
}: {
  slug: string;
  agentName: string;
  greeting: string;
  primaryColor?: string | null;
  /** WebsiteConfig.chatPosition — "bottom-right" (default) or "bottom-left". */
  position?: string | null;
  /** WhatsApp/phone number to fall back to when the AI can't reply (budget out). */
  whatsapp?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [visitorId, setVisitorId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id = localStorage.getItem('nx_visitor_id');
    if (!id) {
      id = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem('nx_visitor_id', id);
    }
    setVisitorId(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, sending]);

  const color = primaryColor || undefined;
  // Shown when the AI can't reply (budget exhausted): keep the customer from a
  // dead end by pointing them to the business directly instead of "unavailable".
  const waLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null;
  const unavailableMsg = waLink
    ? `المساعد الآلي مشغول حالياً 🙏 تواصل معنا مباشرة وبنردّ عليك فوراً: [تواصل عبر واتساب](${waLink})`
    : 'المساعد الآلي مشغول حالياً 🙏 نعتذر، تواصل معنا مباشرة وبنخدمك فوراً.';
  // Physical side from the owner's setting (was hardcoded); mobile offsets sit
  // above the sticky booking bar.
  const side = position === 'bottom-left' ? 'left-5' : 'right-5';

  async function send() {
    const text = input.trim();
    if (!text || sending || !visitorId) return;
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', content: text }]);
    setInput('');
    setSending(true);

    const agentMsgId = `a${Date.now()}`;
    let acc = '';
    let started = false;
    // Decide append-vs-update from the ACTUAL current state (m), not a mutable
    // `started` flag: deltas are processed synchronously in the reader loop, so
    // the flag flips to true before React runs the first (deferred) updater —
    // which would then always take the .map() branch and never append the
    // bubble, so the reply silently never renders. Checking m.some() is
    // race-free regardless of how React batches the updates.
    const upsert = (content: string) =>
      setMessages((m) =>
        m.some((msg) => msg.id === agentMsgId)
          ? m.map((msg) => (msg.id === agentMsgId ? { ...msg, content } : msg))
          : [...m, { id: agentMsgId, role: 'agent' as const, content }]
      );

    try {
      const res = await fetch(`/api/public/${slug}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, visitorId }),
      });

      // Non-stream error responses (rate limit, unavailable) come back as JSON.
      if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
        let reason = '';
        try {
          reason = (await res.json())?.reason ?? '';
        } catch {
          /* ignore */
        }
        upsert(reason === 'rate_limited' ? 'لحظة من فضلك، أرسلت رسائل كثيرة بسرعة.' : 'تعذّر الرد الآن. حاول بعد قليل.');
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
          let evt: { type?: string; text?: string; reply?: string; reason?: string };
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (evt.type === 'delta' && evt.text) {
            acc += evt.text;
            upsert(acc);
            started = true;
          } else if (evt.type === 'done') {
            if (!started) upsert(evt.reply || 'تم.');
          } else if (evt.type === 'error') {
            if (!started) upsert(evt.reason === 'billing_limit' ? unavailableMsg : 'تعذّر الرد الآن. حاول بعد قليل.');
          }
        }
      }
      if (!started) upsert('تعذّر الرد الآن. حاول بعد قليل.');
    } catch {
      if (!started) upsert('فشل الاتصال.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-20 sm:bottom-5 ${side} z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105`}
        style={{ backgroundColor: color ?? '#06b6d4' }}
        aria-label="المحادثة"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Panel */}
      {open && (
        <div className={`fixed bottom-[9.25rem] sm:bottom-24 ${side} z-50 flex h-[26rem] sm:h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-neutral-900`}>
          <header className="flex items-center gap-2 p-3 text-white" style={{ backgroundColor: color ?? '#06b6d4' }}>
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">{agentName}</span>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            <div className="rounded-2xl bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">{greeting}</div>
            {messages.map((m) => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    m.role === 'user' ? 'text-white' : 'bg-neutral-100 dark:bg-neutral-800'
                  )}
                  style={m.role === 'user' ? { backgroundColor: color ?? '#06b6d4' } : undefined}
                >
                  <div className="[&_a]:underline [&_p]:my-0.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {/* "Agent is typing" — the three-dot bounce, until the first token
                streams in (then the reply bubble takes over). */}
            {sending && messages[messages.length - 1]?.role !== 'agent' && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-neutral-100 px-3 py-2.5 dark:bg-neutral-800">
                  <span className="flex items-center gap-1" role="status" aria-label="يكتب…">
                    <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-neutral-400" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 border-t p-2">
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
              placeholder="اكتب رسالتك…"
              className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: color ?? '#06b6d4' }}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
