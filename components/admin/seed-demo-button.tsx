'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { seedDemoTenants } from '@/lib/actions/admin';
import { useConfirm } from '@/components/ui/confirm-dialog';

// Three demo tenants across distinct Saudi sectors, seeded one at a time (each
// request stays short) so the whole platform can be walked against real-ish data.
const TENANTS = [
  { slug: 'basma', label: 'عيادة بسمة الرياض (أسنان)' },
  { slug: 'almaali', label: 'دار المعالي (عقارات)' },
  { slug: 'khedmatak', label: 'خدمتك (خدمات منزلية)' },
];

export function SeedDemoButton() {
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState('');
  const [pending, start] = useTransition();

  async function run() {
    if (
      !(await confirm({
        title:
          'This (re)builds three demo tenants — dental, real-estate, home-services — wiping and rebuilding only their own data. Continue?',
        confirmLabel: tc('confirm'),
        cancelLabel: tc('cancel'),
      }))
    )
      return;
    start(async () => {
      for (const t of TENANTS) {
        setProgress(t.label);
        const r = await seedDemoTenants(t.slug);
        if (!r.ok) {
          toast.error(r.error === 'forbidden' ? 'Super-admin access required.' : `Could not seed /${t.slug}.`);
          setProgress('');
          return;
        }
      }
      setProgress('');
      setDone(true);
      toast.success('Three demo tenants ready — dental, real-estate & home-services.');
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold">
            <Building2 className="size-4 text-primary" /> Multi-sector demo tenants
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Builds <span className="font-mono" dir="ltr">/basma</span> (dental),{' '}
            <span className="font-mono" dir="ltr">/almaali</span> (real-estate) &amp;{' '}
            <span className="font-mono" dir="ltr">/khedmatak</span> (home-services) — full departments, services, AI
            agents, customers, bookings &amp; data. Idempotent — safe to re-run.
          </p>
          {pending && progress && <p className="mt-1 text-xs text-muted-foreground">Seeding {progress}…</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {done &&
            TENANTS.map((t) => (
              <a
                key={t.slug}
                href={`/${t.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs transition hover:bg-accent"
                dir="ltr"
              >
                /{t.slug} <ExternalLink className="size-3" />
              </a>
            ))}
          <Button onClick={run} disabled={pending}>
            {pending ? <Loader2 className="me-1 size-4 animate-spin" /> : <Building2 className="me-1 size-4" />}
            {done ? 'Rebuild' : 'Seed demo tenants'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
