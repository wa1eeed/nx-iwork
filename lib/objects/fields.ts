// Business Objects — the field schema shared by the server actions, the dynamic
// UI, and the agent tools. An ObjectType stores its fields as JSON; this module
// is the single place that parses, validates, and coerces against that schema so
// every surface agrees on what a valid record looks like.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'email'
  | 'phone';

export const FIELD_TYPES: FieldType[] = [
  'text',
  'textarea',
  'number',
  'date',
  'boolean',
  'select',
  'email',
  'phone',
];

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // choices for `select`
}

// A field whose value is shown as the record's title (first text-like field).
const TITLE_TYPES: FieldType[] = ['text', 'email', 'phone'];

// Turn a human label into a stable machine key (ascii-ish, snake_case). Arabic
// labels collapse to empty → callers fall back to field_N.
export function toKey(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || ''
  );
}

// Parse the JSON `fields` column into a validated FieldDef[]. Anything malformed
// is dropped rather than trusted.
export function parseFields(raw: unknown): FieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: FieldDef[] = [];
  const seen = new Set<string>();
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const o = f as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key : '';
    const label = typeof o.label === 'string' ? o.label : '';
    if (!key || !label || seen.has(key)) continue;
    const type = (FIELD_TYPES as string[]).includes(o.type as string)
      ? (o.type as FieldType)
      : 'text';
    const options =
      Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === 'string') : undefined;
    seen.add(key);
    out.push({ key, label, type, required: Boolean(o.required), ...(options?.length ? { options } : {}) });
  }
  return out;
}

// Normalize a raw field-definition list coming from the builder UI: assign a key
// from the label when missing, dedupe, cap count.
export function normalizeFields(raw: Array<Partial<FieldDef>>): FieldDef[] {
  const out: FieldDef[] = [];
  const seen = new Set<string>();
  raw.forEach((f, i) => {
    const label = (f.label ?? '').trim();
    if (!label) return;
    let key = (f.key && f.key.trim()) || toKey(label) || `field_${i + 1}`;
    while (seen.has(key)) key = `${key}_${i + 1}`;
    seen.add(key);
    const type = (FIELD_TYPES as string[]).includes(f.type as string) ? (f.type as FieldType) : 'text';
    const options =
      type === 'select' && Array.isArray(f.options)
        ? f.options.map((o) => String(o).trim()).filter(Boolean)
        : undefined;
    out.push({ key, label, type, required: Boolean(f.required), ...(options?.length ? { options } : {}) });
  });
  return out.slice(0, 40);
}

export type CoerceResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

// Validate + coerce a raw input object against a field schema. Unknown keys are
// dropped (only defined fields survive), types are coerced, required + select
// membership are enforced. `partial` skips required checks (for PATCH-style
// updates).
export function coerceRecord(
  fields: FieldDef[],
  input: Record<string, unknown>,
  partial = false
): CoerceResult {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    const provided = Object.prototype.hasOwnProperty.call(input, f.key);
    const raw = input[f.key];
    const empty = raw === undefined || raw === null || raw === '';

    if (empty) {
      if (partial && !provided) continue; // leave untouched on partial update
      if (f.required && f.type !== 'boolean') {
        return { ok: false, error: `Field "${f.label}" is required` };
      }
      if (f.type === 'boolean') data[f.key] = false;
      else data[f.key] = null;
      continue;
    }

    switch (f.type) {
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
        if (!Number.isFinite(n)) return { ok: false, error: `Field "${f.label}" must be a number` };
        data[f.key] = n;
        break;
      }
      case 'boolean':
        data[f.key] = raw === true || raw === 'true' || raw === 1 || raw === '1';
        break;
      case 'date': {
        const s = String(raw).trim();
        // Accept YYYY-MM-DD or any Date-parseable string; store as-is.
        if (Number.isNaN(Date.parse(s))) return { ok: false, error: `Field "${f.label}" must be a date` };
        data[f.key] = s;
        break;
      }
      case 'select': {
        const s = String(raw).trim();
        if (f.options?.length && !f.options.includes(s)) {
          return { ok: false, error: `Field "${f.label}" must be one of: ${f.options.join(', ')}` };
        }
        data[f.key] = s;
        break;
      }
      case 'email': {
        const s = String(raw).trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) return { ok: false, error: `Field "${f.label}" must be an email` };
        data[f.key] = s;
        break;
      }
      default:
        data[f.key] = String(raw).trim().slice(0, 5000);
    }
  }
  return { ok: true, data };
}

// The record's display title: the first non-empty text-like field value.
export function computeTitle(fields: FieldDef[], data: Record<string, unknown>): string | null {
  for (const f of fields) {
    if (!TITLE_TYPES.includes(f.type)) continue;
    const v = data[f.key];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 140);
  }
  return null;
}

// A short one-line summary of a record for lists / agent output.
export function recordSummary(fields: FieldDef[], data: Record<string, unknown>, max = 3): string {
  const parts: string[] = [];
  for (const f of fields) {
    const v = data[f.key];
    if (v === null || v === undefined || v === '') continue;
    parts.push(`${f.label}: ${typeof v === 'boolean' ? (v ? '✓' : '✗') : v}`);
    if (parts.length >= max) break;
  }
  return parts.join(' · ');
}
