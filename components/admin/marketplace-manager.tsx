'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceIcon, SERVICE_ICONS } from '@/components/dashboard/service-icon';
import {
  createMarketplaceService,
  updateMarketplaceService,
  toggleMarketplaceService,
  deleteMarketplaceService,
  type MarketplaceServiceInput,
} from '@/lib/actions/marketplace';

export interface AdminService {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  price: number;
  icon: string;
  category: string | null;
  active: boolean;
  sortOrder: number;
  grantStorageGb: number | null;
  purchases: number;
}

const EMPTY: MarketplaceServiceInput = {
  title: '',
  titleAr: '',
  description: '',
  descriptionAr: '',
  price: 0,
  icon: 'package',
  category: '',
  active: true,
  sortOrder: 0,
  grantStorageGb: null,
};

export function MarketplaceManager({ services }: { services: AdminService[] }) {
  const t = useTranslations('admin.services');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<MarketplaceServiceInput>(EMPTY);
  const [pending, start] = useTransition();

  const set = <K extends keyof MarketplaceServiceInput>(k: K, v: MarketplaceServiceInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const openNew = () => {
    setForm(EMPTY);
    setEditingId('new');
  };
  const openEdit = (s: AdminService) => {
    setForm({
      title: s.title,
      titleAr: s.titleAr ?? '',
      description: s.description ?? '',
      descriptionAr: s.descriptionAr ?? '',
      price: s.price,
      icon: s.icon,
      category: s.category ?? '',
      active: s.active,
      sortOrder: s.sortOrder,
      grantStorageGb: s.grantStorageGb,
    });
    setEditingId(s.id);
  };
  const close = () => setEditingId(null);

  const onSave = () => {
    if (!form.title?.trim()) {
      toast.error(t('titleRequired'));
      return;
    }
    start(async () => {
      const res =
        editingId === 'new'
          ? await createMarketplaceService(form)
          : await updateMarketplaceService(editingId as string, form);
      if (res.ok) {
        toast.success(t('saved'));
        close();
      } else {
        toast.error(t('saveError'));
      }
    });
  };

  const onToggle = (s: AdminService, active: boolean) =>
    start(async () => {
      const res = await toggleMarketplaceService(s.id, active);
      if (!res.ok) toast.error(t('saveError'));
    });

  const onDelete = (s: AdminService) => {
    if (s.purchases > 0) {
      toast.error(t('inUse'));
      return;
    }
    if (!confirm(t('confirmDelete'))) return;
    start(async () => {
      const res = await deleteMarketplaceService(s.id);
      if (res.ok) toast.success(t('deleted'));
      else if (res.error === 'in_use') toast.error(t('inUse'));
      else toast.error(t('saveError'));
    });
  };

  return (
    <div className="space-y-4">
      {editingId === null && (
        <div className="flex justify-end">
          <Button onClick={openNew}>
            <Plus className="me-1 size-4" />
            {t('add')}
          </Button>
        </div>
      )}

      {editingId !== null && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingId === 'new' ? t('add') : t('edit')}</h3>
              <button onClick={close} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('fTitle')}</Label>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('fTitleAr')}</Label>
                <Input value={form.titleAr ?? ''} onChange={(e) => set('titleAr', e.target.value)} dir="rtl" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('fDesc')}</Label>
                <Textarea rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('fDescAr')}</Label>
                <Textarea rows={2} value={form.descriptionAr ?? ''} onChange={(e) => set('descriptionAr', e.target.value)} dir="rtl" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('fPrice')}</Label>
                <Input type="number" min={0} step={0.5} value={form.price} onChange={(e) => set('price', Number(e.target.value))} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t('fCategory')}</Label>
                <Input value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('fSort')}</Label>
                <Input type="number" min={0} value={form.sortOrder ?? 0} onChange={(e) => set('sortOrder', Number(e.target.value))} dir="ltr" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('fStorageGrant')}</Label>
              <Input
                type="number"
                min={0}
                value={form.grantStorageGb ?? ''}
                onChange={(e) => set('grantStorageGb', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="0"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">{t('fStorageGrantHelp')}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('fIcon')}</Label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_ICONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => set('icon', name)}
                    aria-label={name}
                    className={`flex size-9 items-center justify-center rounded-lg border transition-colors ${
                      form.icon === name
                        ? 'border-primary bg-gradient-brand-soft text-primary'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <ServiceIcon name={name} className="size-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="cursor-default">{t('fActive')}</Label>
              <Switch checked={form.active ?? true} onCheckedChange={(v) => set('active', v)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>
                {t('cancel')}
              </Button>
              <Button onClick={onSave} disabled={pending}>
                {t('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editingId === null &&
        (services.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand-soft text-primary">
                    <ServiceIcon name={s.icon} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {s.title}
                      {!s.active && <span className="ms-2 text-xs text-muted-foreground">({t('inactive')})</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.price === 0 ? t('free') : `SAR ${s.price.toFixed(2)}`} · {t('purchasesCount', { n: s.purchases })}
                    </p>
                  </div>
                  <Switch checked={s.active} onCheckedChange={(v) => onToggle(s, v)} />
                  <Button variant="outline" size="sm" onClick={() => openEdit(s)} aria-label={t('edit')}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(s)}
                    disabled={s.purchases > 0}
                    aria-label={t('delete')}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
    </div>
  );
}
