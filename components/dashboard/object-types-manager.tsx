'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  GripVertical,
  ChevronLeft,
  Database,
  User,
  Users,
  Car,
  Home,
  FileText,
  Briefcase,
  Stethoscope,
  PawPrint,
  Package,
  Calendar,
  Wrench,
  GraduationCap,
  Scissors,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { FIELD_TYPES, type FieldDef, type FieldType } from '@/lib/objects/fields';
import { createObjectType, updateObjectType, deleteObjectType } from '@/lib/actions/objects';

export interface TypeCard {
  id: string;
  name: string;
  nameEn: string | null;
  icon: string | null;
  description: string | null;
  fields: FieldDef[];
  recordCount: number;
}

// Curated icon set so an owner picks a recognizable glyph without free-text.
export const OBJECT_ICONS: Record<string, LucideIcon> = {
  Database, User, Users, Car, Home, FileText, Briefcase, Stethoscope,
  PawPrint, Package, Calendar, Wrench, GraduationCap, Scissors, Building2,
};

function iconOf(name: string | null): LucideIcon {
  return (name && OBJECT_ICONS[name]) || Database;
}

interface FieldRow {
  label: string;
  type: FieldType;
  required: boolean;
  options: string; // comma-separated (select)
}

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

// Server-action error codes we have a localized message for; anything else is
// shown verbatim (e.g. a field-level validation string).
const KNOWN_ERR = new Set(['unauthorized', 'name_required', 'fields_required', 'not_found']);

export function ObjectTypesManager({ types }: { types: TypeCard[] }) {
  const t = useTranslations('pages.data');
  const [editing, setEditing] = useState<TypeCard | 'new' | null>(null);

  if (editing) {
    return <TypeBuilder initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-4">
      {types.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 py-10 text-center">
            <Database className="mx-auto size-8 text-muted-foreground" />
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((ty) => {
          const Icon = iconOf(ty.icon);
          return (
            <div key={ty.id} className="group relative rounded-2xl border bg-card p-4 transition hover:bg-accent/30">
              <Link href={`/data/${ty.id}`} className="block space-y-2">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{ty.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('fieldsCount', { count: ty.fields.length })} · {t('recordsCount', { count: ty.recordCount })}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => setEditing(ty)}
                className="absolute end-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground group-hover:opacity-100"
                aria-label={t('editType')}
              >
                <Pencil className="size-4" />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => setEditing('new')}
          className="flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-4 text-muted-foreground transition hover:bg-accent/30 hover:text-foreground"
        >
          <Plus className="size-5" />
          <span className="text-sm font-medium">{t('newType')}</span>
        </button>
      </div>
    </div>
  );
}

function TypeBuilder({ initial, onClose }: { initial: TypeCard | null; onClose: () => void }) {
  const t = useTranslations('pages.data');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const errMsg = (code: string) => (KNOWN_ERR.has(code) ? t(`err.${code}`) : code);

  const [name, setName] = useState(initial?.name ?? '');
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'Database');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [rows, setRows] = useState<FieldRow[]>(
    initial?.fields.length
      ? initial.fields.map((f) => ({
          label: f.label,
          type: f.type,
          required: Boolean(f.required),
          options: (f.options ?? []).join(', '),
        }))
      : [{ label: '', type: 'text', required: false, options: '' }]
  );

  const setRow = (i: number, patch: Partial<FieldRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { label: '', type: 'text', required: false, options: '' }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const save = () => {
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }
    const fields = rows
      .filter((r) => r.label.trim())
      .map((r) => ({
        label: r.label.trim(),
        type: r.type,
        required: r.required,
        options: r.type === 'select' ? r.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      }));
    if (fields.length === 0) {
      toast.error(t('fieldsRequired'));
      return;
    }
    startSave(async () => {
      const input = { name: name.trim(), nameEn: nameEn.trim() || null, icon, description: description.trim() || null, fields };
      const res = initial ? await updateObjectType(initial.id, input) : await createObjectType(input);
      if (res.ok) {
        toast.success(initial ? t('typeUpdated') : t('typeCreated'));
        router.refresh();
        onClose();
      } else {
        toast.error(errMsg(res.error));
      }
    });
  };

  const remove = () => {
    if (!initial) return;
    startDelete(async () => {
      const ok = await confirm({
        title: t('deleteType'),
        description: t('deleteTypeConfirm', { name: initial.name }),
        confirmLabel: tc('delete'),
        destructive: true,
      });
      if (!ok) return;
      const res = await deleteObjectType(initial.id);
      if (res.ok) {
        toast.success(t('typeDeleted'));
        router.refresh();
        onClose();
      } else {
        toast.error(errMsg(res.error));
      }
    });
  };

  return (
    <div className="space-y-4">
      <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4 rtl:rotate-180" />
        {t('back')}
      </button>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('typeName')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('typeNamePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('typeNameEn')}</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Patient" dir="ltr" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('icon')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(OBJECT_ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  onClick={() => setIcon(key)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg border transition',
                    icon === key ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
                  )}
                  aria-label={key}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('typeDescription')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('typeDescriptionPlaceholder')} />
          </div>

          {/* Field builder */}
          <div className="space-y-2">
            <Label>{t('fields')}</Label>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border bg-muted/20 p-2.5">
                  <div className="flex items-center gap-2">
                    <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
                    <Input
                      value={r.label}
                      onChange={(e) => setRow(i, { label: e.target.value })}
                      placeholder={t('fieldLabelPlaceholder')}
                      className="flex-1"
                    />
                    <select
                      value={r.type}
                      onChange={(e) => setRow(i, { type: e.target.value as FieldType })}
                      className={cn(selectCls, 'w-auto min-w-[120px]')}
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft} value={ft}>
                          {t(`type.${ft}`)}
                        </option>
                      ))}
                    </select>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch checked={r.required} onCheckedChange={(v) => setRow(i, { required: v })} />
                      {t('required')}
                    </label>
                    <button
                      onClick={() => removeRow(i)}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      aria-label={tc('delete')}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  {r.type === 'select' && (
                    <Input
                      value={r.options}
                      onChange={(e) => setRow(i, { options: e.target.value })}
                      placeholder={t('optionsPlaceholder')}
                      className="mt-2 ms-6"
                      dir={locale === 'ar' ? 'rtl' : 'ltr'}
                    />
                  )}
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={addRow} className="gap-1">
              <Plus className="size-4" />
              {t('addField')}
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            {initial ? (
              <Button variant="ghost" onClick={remove} disabled={deleting} className="gap-1 text-destructive hover:text-destructive">
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {t('deleteType')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                {tc('cancel')}
              </Button>
              <Button onClick={save} disabled={saving} className="gap-1">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {initial ? tc('save') : t('createType')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
