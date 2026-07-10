'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Edits the flexible customFields map (string→string). Lets any business add its
// own attributes — bedrooms, check-in time, warranty — without a schema change.
export function KeyValueEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const tc = useTranslations('common');
  // Work on entries (ordered) so editing a key doesn't lose focus/position.
  const entries = Object.entries(value);

  function update(rows: [string, string][]) {
    const obj: Record<string, string> = {};
    for (const [k, v] of rows) if (k.trim()) obj[k.trim()] = v;
    onChange(obj);
  }

  function setRow(i: number, key: string, val: string) {
    const rows = entries.map((e) => [...e] as [string, string]);
    rows[i] = [key, val];
    update(rows);
  }

  function addRow() {
    onChange({ ...value, '': '' });
  }

  function removeRow(i: number) {
    update(entries.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">
          لا حقول مخصصة. أضف أي خاصية تخص نشاطك (مثلاً اللون، الضمان، المساحة).
        </p>
      )}
      {entries.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            placeholder="الخاصية (مثلاً اللون)"
            defaultValue={k}
            onBlur={(e) => setRow(i, e.target.value, v)}
            className="flex-1"
          />
          <Input
            placeholder="القيمة (مثلاً أحمر)"
            value={v}
            onChange={(e) => setRow(i, k, e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeRow(i)}
            className="shrink-0 text-destructive hover:text-destructive"
            aria-label={tc('delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="me-1 h-3.5 w-3.5" />
        إضافة حقل
      </Button>
    </div>
  );
}
