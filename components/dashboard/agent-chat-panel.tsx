'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Embedded single-agent chat — the agent's own workspace tab. Talks to the same
// SSE endpoint as the main chat (/api/agents/[id]/chat) but inline, so the owner
// never has to leave the agent to talk to it. App-themed (not the neon console).

interface Msg {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

export function AgentChatPanel({
  agentId,
  agentName,
  locale,
}: {
  agentId: string;
  agentName: string;
  locale: 'en' | 'ar';
}) {
  const en = locale === 'en';
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || sending) return;
    const aId = `a-${Date.now()}`;
    const setAgent = (content: string) =>
      setMessages((m) => m.map((x) => (x.id === aId ? { ...x, content } : x)));

    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: 'user', content: body },
      { id: aId, role: 'agent', content: '' },
    ]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/agents/${agentId}/chat`, {
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
    }
  }

  return (
    <div className="flex h-[520px] flex-col rounded-2xl border bg-card">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">
              {en ? `Chat with ${agentName} — ask it anything or give it a task.` : `حادِث ${agentName} — اسأله أو كلّفه بمهمة.`}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              {m.role === 'agent' && !m.content ? (
                <Loader2 className="size-4 animate-spin" />
              ) : m.role === 'agent' ? (
                <div className="prose-chat space-y-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 border-t p-3">
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
          placeholder={en ? 'Type a message…' : 'اكتب رسالة…'}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="size-10 shrink-0">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
