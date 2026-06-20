'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Globe, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { updateCustomDomain } from '@/lib/actions/settings';

export function CustomDomainTab({
  initial,
  host,
  appIp,
}: {
  initial: { customDomain: string | null; verified: boolean };
  host: string;
  appIp: string;
}) {
  const t = useTranslations('settings');
  const td = useTranslations('settings.domain');
  const [domain, setDomain] = useState(initial.customDomain ?? '');
  const [saved, setSaved] = useState(initial.customDomain ?? '');
  const [isPending, start] = useTransition();

  const submit = (value: string) => {
    start(async () => {
      const res = await updateCustomDomain({ customDomain: value });
      if (res.ok) {
        setSaved(value);
        toast.success(t('saved'));
      } else if (res.error === 'domain_taken') {
        toast.error(td('errorTaken'));
      } else {
        toast.error(td('errorInvalid'));
      }
    });
  };

  // CNAME for subdomains, A record for apex — show the relevant one.
  const isApex = saved.length > 0 && saved.split('.').length <= 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-primary" />
          {td('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">{td('subtitle', { host, slug: 'you' })}</p>

        <div className="space-y-2">
          <Label htmlFor="domain">{td('domain')}</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={td('domainPlaceholder')}
              dir="ltr"
              className="flex-1 font-mono"
            />
            <Button onClick={() => submit(domain.trim())} disabled={isPending || domain.trim() === saved}>
              {td('connect')}
            </Button>
            {saved && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDomain('');
                  submit('');
                }}
                disabled={isPending}
              >
                {td('clear')}
              </Button>
            )}
          </div>
        </div>

        {saved && (
          <>
            <div
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                initial.verified
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              )}
            >
              {initial.verified ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              {initial.verified ? td('statusVerified') : td('statusPending')}
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">{td('dnsTitle')}</p>
                <p className="text-xs text-muted-foreground">{td('dnsHelp')}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm" dir="ltr">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="pb-1 pe-4 text-start font-medium">{td('dnsType')}</th>
                      <th className="pb-1 pe-4 text-start font-medium">{td('dnsName')}</th>
                      <th className="pb-1 text-start font-medium">{td('dnsValue')}</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {isApex ? (
                      <tr>
                        <td className="pe-4 py-1">A</td>
                        <td className="pe-4 py-1">@</td>
                        <td className="py-1">{appIp}</td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="pe-4 py-1">CNAME</td>
                        <td className="pe-4 py-1">{saved.split('.')[0]}</td>
                        <td className="py-1">{host}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">{isApex ? td('aNote') : td('cnameNote')}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
