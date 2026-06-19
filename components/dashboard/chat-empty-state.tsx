'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bot, Loader2, Sparkles, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createDefaultAgentAction } from '@/lib/actions/agents';

export function ChatEmptyState({
  hasCompany,
  keyReady,
}: {
  hasCompany: boolean;
  keyReady?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    setCreating(true);
    startTransition(async () => {
      const res = await createDefaultAgentAction();
      setCreating(false);
      if (res.ok) {
        toast.success('تم إنشاء أول موظف ذكي: سُهى (خدمة العملاء)');
        router.refresh();
      } else {
        toast.error('تعذّر إنشاء الموظف. حاول مرة أخرى.');
      }
    });
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-7 w-7" />
          </div>
          <CardTitle>وظّف أول موظف ذكي</CardTitle>
          <CardDescription>
            ابدأ بموظف خدمة عملاء جاهز. تقدر تعدّل شخصيته ومعلوماته لاحقاً من
            صفحة الموظفين.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!keyReady && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-right text-sm text-amber-600 dark:text-amber-400">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                لتشغيل الموظف فعلياً، أضف مفتاح الذكاء الاصطناعي من{' '}
                <Link href="/settings" className="underline">
                  الإعدادات
                </Link>
                .
              </span>
            </div>
          )}
          <Button
            onClick={handleCreate}
            disabled={!hasCompany || isPending || creating}
            className="w-full"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            إنشاء موظف خدمة العملاء
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
