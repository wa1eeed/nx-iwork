'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteProduct } from '@/lib/actions/products';
import { useConfirm } from '@/components/ui/confirm-dialog';

export function DeleteProductButton({ id }: { id: string }) {
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();

  async function onDelete() {
    if (!(await confirm({ title: 'حذف هذا المنتج نهائياً؟', destructive: true, confirmLabel: tc('delete'), cancelLabel: tc('cancel') }))) return;
    start(async () => {
      const res = await deleteProduct(id);
      if (res.ok) {
        toast.success('تم حذف المنتج.');
        router.push('/products');
        router.refresh();
      } else {
        toast.error('تعذّر الحذف.');
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onDelete}
      disabled={pending}
      className="text-destructive hover:text-destructive"
    >
      {pending ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <Trash2 className="me-1 h-4 w-4" />}
      حذف
    </Button>
  );
}
