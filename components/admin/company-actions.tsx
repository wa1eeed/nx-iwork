'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Coins, Wallet, Activity } from 'lucide-react';
import type { CompanyStatus, PlanTier } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { feedback } from '@/lib/ui/feedback';
import { topUpTokens, setCompanyPlan, setCompanyStatus } from '@/lib/actions/admin';

const TIERS: PlanTier[] = ['FREE', 'STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE'];
const STATUSES: CompanyStatus[] = ['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED'];
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function CompanyActions({
  companyId,
  plan,
  status,
}: {
  companyId: string;
  plan: PlanTier;
  status: CompanyStatus;
}) {
  const t = useTranslations('admin.company');
  const ts = useTranslations('admin.status');
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [pending, start] = useTransition();

  function topUp() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return feedback('error', t('failed'));
    start(async () => {
      const res = await topUpTokens(companyId, n);
      if (res.ok) {
        feedback('success', t('toppedUp'));
        setAmount('');
        router.refresh();
      } else feedback('error', t('failed'));
    });
  }

  function changePlan(tier: PlanTier) {
    start(async () => {
      const res = await setCompanyPlan(companyId, tier);
      if (res.ok) {
        feedback('success', t('planChanged'));
        router.refresh();
      } else feedback('error', t('failed'));
    });
  }

  function changeStatus(s: CompanyStatus) {
    start(async () => {
      const res = await setCompanyStatus(companyId, s);
      if (res.ok) {
        feedback(s === 'SUSPENDED' ? 'approval' : 'info', t('statusChanged'));
        router.refresh();
      } else feedback('error', t('failed'));
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="space-y-2 p-4">
          <Label className="flex items-center gap-1.5 text-xs"><Coins className="size-3.5" />{t('topUp')}</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('topUpPlaceholder')}
              dir="ltr"
              className="font-mono"
            />
            <Button onClick={topUp} disabled={pending || !amount}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : t('topUpBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <Label className="flex items-center gap-1.5 text-xs"><Wallet className="size-3.5" />{t('changePlan')}</Label>
          <select className={selectCls} defaultValue={plan} disabled={pending} onChange={(e) => changePlan(e.target.value as PlanTier)}>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>{tier}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <Label className="flex items-center gap-1.5 text-xs"><Activity className="size-3.5" />{t('setStatus')}</Label>
          <select className={selectCls} defaultValue={status} disabled={pending} onChange={(e) => changeStatus(e.target.value as CompanyStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{ts(s)}</option>
            ))}
          </select>
        </CardContent>
      </Card>
    </div>
  );
}
