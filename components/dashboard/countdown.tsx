'use client';

import { useEffect, useState } from 'react';

// Live countdown to a target time (e.g. an AgentSchedule's next run). Ticks each
// second; shows days/hours/minutes/seconds as relevant, or "حان وقت التنفيذ"
// once due.
export function Countdown({ target }: { target: string }) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  // Start ticking only on the client to avoid hydration mismatch.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span className="tabular-nums">…</span>;

  const diff = targetMs - now;
  if (Number.isNaN(targetMs)) return null;
  if (diff <= 0) {
    return <span className="font-medium text-amber-500">حان وقت التنفيذ</span>;
  }

  const s = Math.floor(diff / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}ي`);
  if (days || hours) parts.push(`${hours}س`);
  parts.push(`${mins}د`);
  if (!days) parts.push(`${secs}ث`); // seconds only matter for short waits

  return (
    <span className="tabular-nums font-medium text-foreground">
      باقي {parts.join(' ')}
    </span>
  );
}
