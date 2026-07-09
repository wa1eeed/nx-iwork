'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { seedRefineDemo } from '@/lib/actions/admin';

// One-click builder for the Refine Medical Complex client demo (super-admin only).
export function SeedRefineButton() {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function run() {
    if (!window.confirm('This will (re)build the “Refine” demo tenant — wiping and rebuilding only its data. Continue?')) return;
    start(async () => {
      const r = await seedRefineDemo();
      if (r.ok) {
        setDone(true);
        toast.success(`Refine demo ready — ${r.services} services across ${r.clinics} clinics.`);
      } else {
        toast.error(r.error === 'forbidden' ? 'Super-admin access required.' : 'Could not run the seed.');
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" /> Refine Medical Complex — client demo
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Builds the <span className="font-mono" dir="ltr">/refine</span> tenant with real clinics, services,
            staff, and the booking chatbot. Idempotent — safe to re-run before a demo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {done && (
            <>
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> Done
              </span>
              <a
                href="/refine"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition hover:bg-accent"
              >
                Open /refine <ExternalLink className="size-3.5" />
              </a>
            </>
          )}
          <Button onClick={run} disabled={pending}>
            {pending ? <Loader2 className="me-1 size-4 animate-spin" /> : <Sparkles className="me-1 size-4" />}
            {done ? 'Rebuild' : 'Seed Refine demo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
