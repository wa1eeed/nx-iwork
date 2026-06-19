'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ImageUpload } from '@/components/dashboard/image-upload';
import { KeyValueEditor } from '@/components/dashboard/key-value-editor';
import { createProduct, updateProduct } from '@/lib/actions/products';
import type { ProductInput } from '@/lib/validators/products';

export interface ProductFormValues {
  id?: string;
  title: string;
  titleEn: string;
  description: string;
  price: string;
  comparePrice: string;
  sku: string;
  unlimitedStock: boolean;
  stock: string;
  images: string[];
  isActive: boolean;
  customFields: Record<string, string>;
}

const EMPTY: ProductFormValues = {
  title: '',
  titleEn: '',
  description: '',
  price: '',
  comparePrice: '',
  sku: '',
  unlimitedStock: true,
  stock: '0',
  images: [],
  isActive: true,
  customFields: {},
};

export function ProductForm({ initial }: { initial?: ProductFormValues }) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValues>(initial ?? EMPTY);
  const [saving, startSave] = useTransition();
  const isEdit = Boolean(initial?.id);

  function set<K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: val }));
  }

  function submit() {
    if (!v.title.trim()) return toast.error('اسم المنتج مطلوب.');
    if (v.price === '' || Number.isNaN(Number(v.price)))
      return toast.error('أدخل سعراً صحيحاً.');

    const payload: ProductInput = {
      title: v.title.trim(),
      titleEn: v.titleEn.trim() || null,
      description: v.description.trim(),
      price: Number(v.price),
      comparePrice: v.comparePrice.trim() ? Number(v.comparePrice) : null,
      sku: v.sku.trim() || null,
      stock: v.unlimitedStock ? -1 : Number(v.stock || 0),
      images: v.images,
      isActive: v.isActive,
      customFields: v.customFields,
    };

    startSave(async () => {
      const res = isEdit
        ? await updateProduct(initial!.id!, payload)
        : await createProduct(payload);
      if (res.ok) {
        toast.success(isEdit ? 'تم حفظ المنتج.' : 'تمت إضافة المنتج.');
        router.push('/products');
        router.refresh();
      } else {
        toast.error(res.error === 'validation' ? 'تحقق من الحقول.' : 'تعذّر الحفظ.');
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">المعلومات الأساسية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">اسم المنتج *</Label>
            <Input id="title" value={v.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="titleEn">الاسم بالإنجليزية (اختياري)</Label>
            <Input id="titleEn" dir="ltr" value={v.titleEn} onChange={(e) => set('titleEn', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">الوصف</Label>
            <Textarea id="desc" rows={4} value={v.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">السعر والمخزون</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">السعر *</Label>
              <Input id="price" type="number" inputMode="decimal" dir="ltr" value={v.price} onChange={(e) => set('price', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compare">السعر قبل الخصم (اختياري)</Label>
              <Input id="compare" type="number" inputMode="decimal" dir="ltr" value={v.comparePrice} onChange={(e) => set('comparePrice', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">SKU (اختياري)</Label>
            <Input id="sku" dir="ltr" value={v.sku} onChange={(e) => set('sku', e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">مخزون غير محدود</p>
              <p className="text-xs text-muted-foreground">أطفئه لتحديد كمية</p>
            </div>
            <Switch checked={v.unlimitedStock} onCheckedChange={(c) => set('unlimitedStock', c)} />
          </div>
          {!v.unlimitedStock && (
            <div className="space-y-2">
              <Label htmlFor="stock">الكمية المتوفرة</Label>
              <Input id="stock" type="number" dir="ltr" value={v.stock} onChange={(e) => set('stock', e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الصور</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload value={v.images} onChange={(urls) => set('images', urls)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">حقول مخصصة</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueEditor value={v.customFields} onChange={(cf) => set('customFields', cf)} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={v.isActive} onCheckedChange={(c) => set('isActive', c)} />
          <span className="text-sm">{v.isActive ? 'معروض' : 'مخفي'}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.push('/products')} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
            {isEdit ? 'حفظ' : 'إضافة المنتج'}
          </Button>
        </div>
      </div>
    </div>
  );
}
