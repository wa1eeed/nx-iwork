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
    const signRes = await fetch('/api/uploads/sign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contentType: file.type, purpose }),
    });
    const signed = await signRes.json();
    if (!signed.ok) {
      if (signed.reason === 'storage_not_configured') {
        toast.error('التخزين غير مُهيأ بعد (R2). راجع الإعدادات.');
      } else if (signed.reason === 'unsupported_type') {
        toast.error('نوع الملف غير مدعوم. استخدم PNG/JPG/WebP/GIF.');
      } else {
        toast.error('تعذّر تجهيز الرفع.');
      }
      return null;
    }

    const put = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: file,
    });
    if (!put.ok) {
      toast.error('فشل رفع الصورة.');
      return null;
    }
    return signed.publicUrl as string;
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
    onChange(value.filter((u) => u !== url));
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
