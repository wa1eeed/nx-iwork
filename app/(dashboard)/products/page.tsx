import Link from 'next/link';
import Image from 'next/image';
import { Plus, Package } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getUserCompany } from '@/lib/companies';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Catalog list. This same data is what the sales agent reads via the
// search_catalog tool — one source of truth for dashboard + agents + public page.
export default async function ProductsPage() {
  const session = await auth();
  const companyId = session?.user?.id ? await getUserCompany(session.user.id) : null;

  const products = companyId
    ? await db.product.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ref: true,
          title: true,
          price: true,
          stock: true,
          isActive: true,
          images: true,
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">المنتجات</h1>
          <p className="text-sm text-muted-foreground">
            الكتالوج الذي يقرأ منه وكلاؤك ويُعرض في صفحتك العامة.
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="me-1 h-4 w-4" />
            منتج جديد
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package className="h-7 w-7" />
            </div>
            <p className="text-sm text-muted-foreground">لا منتجات بعد.</p>
            <Button asChild variant="outline">
              <Link href="/products/new">أضف أول منتج</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`}>
              <Card className="transition hover:border-primary/50">
                <CardContent className="flex items-center gap-4 p-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {p.images[0] ? (
                      <Image src={p.images[0]} alt="" fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {p.ref && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                          {p.ref}
                        </span>
                      )}
                      {p.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.price.toString()} · {p.stock === -1 ? 'غير محدود' : `${p.stock} متوفر`}
                    </p>
                  </div>
                  {!p.isActive && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      مخفي
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
