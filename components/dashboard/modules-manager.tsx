'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Wrench, CalendarCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { updateModules } from '@/lib/actions/modules';

export interface ModulesState {
  hasEcommerce: boolean;
  hasServices: boolean;
  hasBookings: boolean;
}

const MODULES: {
  key: keyof ModulesState;
  title: string;
  desc: string;
  icon: typeof ShoppingCart;
}[] = [
  { key: 'hasEcommerce', title: 'التجارة الإلكترونية', desc: 'منتجات، مخزون، أسعار — للمتاجر', icon: ShoppingCart },
  { key: 'hasServices', title: 'الخدمات حسب الطلب', desc: 'باقات وخدمات — للوكالات والمزوّدين', icon: Wrench },
  { key: 'hasBookings', title: 'الحجوزات والمواعيد', desc: 'مواعيد وتوافر — للعيادات والتأجير', icon: CalendarCheck },
];

export function ModulesManager({ initial }: { initial: ModulesState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [saving, start] = useTransition();

  function toggle(key: keyof ModulesState, value: boolean) {
    const next = { ...state, [key]: value };
    setState(next);
    start(async () => {
      const res = await updateModules(next);
      if (res.ok) {
        toast.success('تم تحديث الموديولات.');
        router.refresh();
      } else {
        setState(state); // revert
        toast.error('تعذّر التحديث.');
      }
    });
  }

  return (
    <div className="grid gap-3">
      {MODULES.map((m) => {
        const Icon = m.icon;
        const on = state[m.key];
        return (
          <Card key={m.key}>
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className={
                  'flex h-11 w-11 items-center justify-center rounded-xl ' +
                  (on ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')
                }
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </div>
              {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch checked={on} onCheckedChange={(v) => toggle(m.key, v)} disabled={saving} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
