'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, X, Check, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { FieldDef } from '@/lib/objects/fields';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions/objects';

export interface RecordRow {
  id: string;
  data: Record<string, unknown>;
  title: string | null;
  createdAt: string;
}

const KNOWN_ERR = new Set(['unauthorized', 'not_found']);
const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

type FormValues = Record<string, string | boolean>;

function toForm(fields: FieldDef[], data: Record<string, unknown>): FormValues {
  const v: FormValues = {};
  for (const f of fields) {
    const raw = data[f.key];
    if (f.type === 'boolean') v[f.key] = raw === true;
    else v[f.key] = raw === null || raw === undefined ? '' : String(raw);
  }
  return v;
}

export function ObjectRecordsManager({
  typeId,
  fields,
  records,
}: {
  typeId: string;
  fields: FieldDef[];
  records: RecordRow[];
}) {
  const t = useTranslations('pages.data');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<RecordRow | 'new' | null>(null);
  const [saving, startSave] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const errMsg = (code: string) => (KNOWN_ERR.has(code) ? t(`err.${code}`) : code);

  const [form, setForm] = useState<FormValues>({});

  const openNew = () => {
    setForm(toForm(fields, {}));
    setEditing('new');
  };
  const openEdit = (r: RecordRow) => {
    setForm(toForm(fields, r.data));
    setEditing(r);
  };
  const close = () => setEditing(null);

  const save = () => {
    startSave(async () => {
      const res =
        editing === 'new'
          ? await createRecord(typeId, form)
          : editing
            ? await updateRecord(editing.id, form)
            : { ok: false as const, error: 'not_found' };
      if (res.ok) {
        toast.success(editing === 'new' ? t('recordAdded') : t('recordUpdated'));
        router.refresh();
        close();
      } else {
        toast.error(errMsg(res.error));
      }
    });
  };

  const remove = async (r: RecordRow) => {
    const ok = await confirm({
      title: t('deleteRecord'),
      description: t('deleteRecordConfirm'),
      confirmLabel: tc('delete'),
      destructive: true,
    });
    if (!ok) return;
    setBusyId(r.id);
    const res = await deleteRecord(r.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(t('recordDeleted'));
      router.refresh();
    } else {
      toast.error(errMsg(res.error));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-1">
          <Plus className="size-4" />
          {t('addRecord')}
        </Button>
      </div>

      {editing && (
        <Card>
          <CardContent className="space-y-4 p-5">
            <p className="font-medium">{editing === 'new' ? t('addRecord') : t('editRecord')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={form[f.key]}
                  onChange={(val) => setForm((s) => ({ ...s, [f.key]: val }))}
                  locale={locale}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={close}>
                {tc('cancel')}
              </Button>
              <Button onClick={save} disabled={saving} className="gap-1">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {tc('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {records.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('noRecords')}</p>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-xs text-muted-foreground">
                  {fields.map((f) => (
                    <th key={f.key} className="whitespace-nowrap px-4 py-2.5 text-start font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-accent/30">
                    {fields.map((f) => (
                      <td key={f.key} className="whitespace-nowrap px-4 py-2.5">
                        <CellValue field={f} value={r.data[f.key]} locale={locale} />
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={t('editRecord')}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          onClick={() => remove(r)}
                          disabled={busyId === r.id}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                          aria-label={t('deleteRecord')}
                        >
                          {busyId === r.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  locale,
}: {
  field: FieldDef;
  value: string | boolean | undefined;
  onChange: (v: string | boolean) => void;
  locale: string;
}) {
  const label = (
    <Label className="flex items-center gap-1">
      {field.label}
      {field.required && <span className="text-destructive">*</span>}
    </Label>
  );

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between rounded-lg border p-3">
        {label}
        <Switch checked={value === true} onCheckedChange={(v) => onChange(v)} />
      </div>
    );
  }

  const str = typeof value === 'string' ? value : '';
  return (
    <div className="space-y-1.5">
      {label}
      {field.type === 'textarea' ? (
        <Textarea value={str} onChange={(e) => onChange(e.target.value)} rows={2} />
      ) : field.type === 'select' ? (
        <select value={str} onChange={(e) => onChange(e.target.value)} className={selectCls} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <Input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
          value={str}
          onChange={(e) => onChange(e.target.value)}
          dir={field.type === 'email' || field.type === 'phone' || field.type === 'number' ? 'ltr' : undefined}
        />
      )}
    </div>
  );
}

function CellValue({ field, value, locale }: { field: FieldDef; value: unknown; locale: string }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground/50"><Minus className="size-3.5" /></span>;
  }
  if (field.type === 'boolean') {
    return value ? <Check className="size-4 text-emerald-500" /> : <X className="size-4 text-muted-foreground" />;
  }
  if (field.type === 'date') {
    const s = String(value);
    return <span>{Number.isNaN(Date.parse(s)) ? s : formatDate(s, locale)}</span>;
  }
  if (field.type === 'select') {
    return (
      <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs">{String(value)}</span>
    );
  }
  const text = String(value);
  return <span className={cn(text.length > 40 && 'block max-w-[240px] truncate')}>{text}</span>;
}
