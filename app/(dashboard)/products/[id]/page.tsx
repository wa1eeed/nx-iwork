import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { ProductForm, type ProductFormValues } from '@/components/dashboard/product-form';
import { DeleteProductButton } from '@/components/dashboard/delete-product-button';

// Coerce the flexible JSON column into the string→string shape the editor uses.
function toStringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return out;
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;
  if (!companyId) redirect('/login');

  const product = await db.product.findFirst({
    where: { id, companyId },
  });
  if (!product) notFound();

  const initial: ProductFormValues = {
    id: product.id,
    title: product.title,
    titleEn: product.titleEn ?? '',
    description: product.description,
    price: product.price.toString(),
    comparePrice: product.comparePrice?.toString() ?? '',
    sku: product.sku ?? '',
    unlimitedStock: product.stock === -1,
    stock: product.stock === -1 ? '0' : String(product.stock),
    images: product.images,
    isActive: product.isActive,
    customFields: toStringMap(product.customFields),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          المنتجات
        </Link>
        <DeleteProductButton id={product.id} />
      </div>
      <h1 className="text-xl font-semibold">تعديل المنتج</h1>
      <ProductForm initial={initial} />
    </div>
  );
}
