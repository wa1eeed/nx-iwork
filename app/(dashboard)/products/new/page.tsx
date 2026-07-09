import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductForm } from '@/components/dashboard/product-form';

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        المنتجات
      </Link>
      <h1 className="text-xl font-semibold">منتج جديد</h1>
      <ProductForm />
    </div>
  );
}
