'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Direct-to-R2 uploader: asks our API for a presigned PUT, then uploads the file
// straight to the bucket (bytes never touch our server). Value is the list of
// public URLs; parent persists them.
export function ImageUpload({
  value,
  onChange,
  max = 8,
  purpose = 'products',
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  purpose?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadOne(file: File): Promise<string | null> {
    // Server compresses (WebP q80, ≤1200px) then stores in R2.
    const fd = new FormData();
    fd.append('file', file);
    fd.append('purpose', purpose);
    const res = await fetch('/api/uploads/image', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) {
      if (data.reason === 'storage_not_configured') {
        toast.error('التخزين غير مُهيأ بعد (R2). راجع الإعدادات.');
      } else if (data.reason === 'unsupported_type') {
        toast.error('نوع الملف غير مدعوم. استخدم PNG/JPG/WebP/GIF.');
      } else if (data.reason === 'quota_exceeded') {
        toast.error('تجاوزت سعة التخزين في باقتك. رقّي باقتك أو اشترِ مساحة إضافية من الخدمات.');
      } else if (data.reason === 'too_large') {
        toast.error('حجم الملف كبير جداً (الحد 25MB).');
      } else {
        toast.error('تعذّر رفع الصورة.');
      }
      return null;
    }
    return data.publicUrl as string;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    const room = max - value.length;
    if (room <= 0) {
      toast.error(`الحد الأقصى ${max} صور.`);
      return;
    }

    setUploading(true);
    const urls: string[] = [];
    for (const file of files.slice(0, room)) {
      const url = await uploadOne(file);
      if (url) urls.push(url);
    }
    setUploading(false);
    if (urls.length) onChange([...value, ...urls]);
  }

  function remove(url: string) {
    onChange(value.filter((u) => u !== url)); // optimistic
    // Free the object in R2 + the tenant's storage counter (best-effort).
    fetch('/api/uploads/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    }).catch(() => {});
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {value.map((url) => (
          <div key={url} className="relative h-24 w-24 overflow-hidden rounded-lg border">
            <Image src={url} alt="" fill sizes="96px" className="object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute end-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="حذف"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
            رفع صورة
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={onPick}
      />
    </div>
  );
}
