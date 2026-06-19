'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Send, KeyRound } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface AgentSummary {
  id: string;
  name: string;
  initial: string;
  role: string;
  status: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
}

const ERROR_LABELS: Record<string, string> = {
  no_key: 'لم يتم إضافة مفتاح الذكاء الاصطناعي بعد. أضفه من الإعدادات.',
  billing_limit: 'انتهى رصيد التوكنز. جدّد باقتك للاستمرار.',
  vertex_not_configured: 'خدمة الذكاء (Vertex) غير مهيأة. تواصل مع الدعم.',
  no_settings: 'إعدادات الذكاء الاصطناعي غير مهيأة.',
  decrypt_failed: 'تعذّر قراءة المفتاح. أعد إدخاله من الإعدادات.',
  provider_error: 'حدث خطأ من مزوّد الذكاء الاصطناعي. حاول مرة أخرى.',
  empty_message: 'الرسالة فارغة.',
  message_too_long: 'الرسالة طويلة جداً.',
};

export function ChatClient({
  agents,
  keyReady,
  provider,
}: {
  agents: AgentSummary[];
  keyReady: boolean;
  provider: string;
}) {
  const [activeId, setActiveId] = useState(agents[0].id);
  // Threads are kept in memory per agent for the session; server-side history
  // is the source of truth and reloads on refresh.
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeAgent = agents.find((a) => a.id === activeId)!;
  const messages = threads[activeId] ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setThreads((t) => ({ ...t, [activeId]: [...(t[activeId] ?? []), userMsg] }));
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/agents/${activeId}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      if (data.ok) {
        setThreads((t) => ({
          ...t,
          [activeId]: [
            ...(t[activeId] ?? []),
            { id: `a-${Date.now()}`, role: 'agent', content: data.reply },
          ],
        }));
      } else {
        toast.error(ERROR_LABELS[data.reason] ?? 'تعذّر إرسال الرسالة.');
      }
    } catch {
      toast.error('فشل الاتصال بالخادم.');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Agent list */}
      <aside className="hidden w-56 shrink-0 flex-col gap-1 md:flex">
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
          الموظفون ({agents.length})
        </p>
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setActiveId(a.id)}
            className={cn(
              'flex items-center gap-3 rounded-lg p-2 text-right transition',
              a.id === activeId ? 'bg-primary/10' : 'hover:bg-muted'
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              {a.initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {a.role}
              </span>
            </span>
          </button>
        ))}
      </aside>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border bg-card">
        <header className="flex items-center gap-3 border-b p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
            {activeAgent.initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{activeAgent.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {activeAgent.role} · {provider === 'google' ? 'Gemini' : 'Claude'}
            </p>
          </div>
        </header>

        {!keyReady && (
          <div className="flex items-center gap-2 border-b bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
            <KeyRound className="h-4 w-4" />
            <span>
              أضف مفتاح الذكاء الاصطناعي من{' '}
              <Link href="/settings" className="underline">
                الإعدادات
              </Link>{' '}
              ليرد الموظف فعلياً.
            </span>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="pt-10 text-center text-sm text-muted-foreground">
              ابدأ المحادثة مع {activeAgent.name}…
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex',
                m.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {/* No typography plugin in this project, so style the common
                    markdown nodes explicitly for readable replies. */}
                <div className="space-y-1 [&_a]:underline [&_li]:ms-4 [&_li]:list-disc [&_strong]:font-semibold">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                يكتب…
              </div>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="اكتب رسالتك…"
            rows={1}
            className="max-h-32 min-h-[2.5rem] resize-none"
          />
          <Button
            onClick={send}
            disabled={sending || !input.trim()}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
