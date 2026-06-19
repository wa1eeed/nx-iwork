'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { deleteProduct } from '@/lib/actions/products';

export function DeleteProductButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onDelete() {
    // Native confirm keeps this dependency-free; a styled dialog can replace it
    // once a Dialog primitive lands.
    if (!window.confirm('حذف هذا المنتج نهائياً؟')) return;
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
