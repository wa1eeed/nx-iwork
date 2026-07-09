'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Pencil, Trash2, Loader2, X, FileText, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { createSitePage, updateSitePage, deleteSitePage } from '@/lib/actions/site-pages';

export interface SitePageRow {
  id: string;
  title: string;
  titleEn: string | null;
  slug: string;
  content: string;
  contentEn: string | null;
  showInFooter: boolean;
  showInNav: boolean;
  isPublished: boolean;
}

interface FormState {
  title: string;
  titleEn: string;
  content: string;
  contentEn: string;
  showInFooter: boolean;
  showInNav: boolean;
  isPublished: boolean;
}

const EMPTY: FormState = {
  title: '',
  titleEn: '',
  content: '',
  contentEn: '',
  showInFooter: true,
  showInNav: false,
  isPublished: true,
};

export function SitePagesManager({ pages, siteSlug }: { pages: SitePageRow[]; siteSlug: string | null }) {
  const t = useTranslations('biz.pages');
  const locale = useLocale();
  const en = locale === 'en';
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, startSave] = useTransition();

  const showForm = adding || editingId !== null;

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, saving]);

  function openAdd() {
    setForm(EMPTY);
    setEditingId(null);
    setAdding(true);
  }

  function openEdit(p: SitePageRow) {
    setForm({
      title: p.title,
      titleEn: p.titleEn ?? '',
      content: p.content,
      contentEn: p.contentEn ?? '',
      showInFooter: p.showInFooter,
      showInNav: p.showInNav,
      isPublished: p.isPublished,
    });
    setEditingId(p.id);
    setAdding(false);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  function save() {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      titleEn: form.titleEn.trim() || null,
      content: form.content,
      contentEn: form.contentEn.trim() || null,
      showInFooter: form.showInFooter,
      showInNav: form.showInNav,
      isPublished: form.isPublished,
    };
    startSave(async () => {
      const res = editingId ? await updateSitePage(editingId, payload) : await createSitePage(payload);
      if (res.ok) {
        toast.success(editingId ? t('updated') : t('created'));
        cancel();
        router.refresh();
      } else {
        toast.error(t('saveError'));
      }
    });
  }

  function remove(p: SitePageRow) {
    if (!window.confirm(t('confirmDelete', { name: p.title }))) return;
    startSave(async () => {
      const res = await deleteSitePage(p.id);
      if (res.ok) {
        toast.success(t('deleted'));
        router.refresh();
      } else {
        toast.error(t('deleteError'));
      }
    });
  }

  return (
    <div className="space-y-4">
      <Button onClick={openAdd}>
        <Plus className="me-1 h-4 w-4" />
        {t('new')}
      </Button>

      <div className="grid gap-3">
        {pages.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          pages.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{en ? p.titleEn || p.title : p.title}</p>
                    {!p.isPublished && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t('draft')}
                      </span>
                    )}
                    {p.showInFooter && (
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
                        {t('inFooter')}
                      </span>
                    )}
                    {p.showInNav && (
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                        {t('inNav')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" dir="ltr">
                    /{siteSlug ?? '…'}/p/{p.slug}
                  </p>
                </div>
                {siteSlug && p.isPublished && (
                  <a
                    href={`/${siteSlug}/p/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    aria-label={t('view')}
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(p)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && cancel()} />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-semibold">{editingId ? t('editTitle') : t('newTitle')}</h2>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted"
                aria-label={t('cancel')}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="space-y-1.5">
                <Label>{t('nameLabel')}</Label>
                <Input
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('namePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('titleEnLabel')}</Label>
                <Input
                  dir="ltr"
                  value={form.titleEn}
                  onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('contentLabel')}</Label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={t('contentPlaceholder')}
                  rows={10}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[11px] text-muted-foreground">{t('contentHint')}</p>
              </div>

              <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.showInFooter}
                    onChange={(e) => setForm({ ...form, showInFooter: e.target.checked })}
                    className="size-4 rounded border"
                  />
                  {t('showInFooter')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.showInNav}
                    onChange={(e) => setForm({ ...form, showInNav: e.target.checked })}
                    className="size-4 rounded border"
                  />
                  {t('showInNav')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                    className="size-4 rounded border"
                  />
                  {t('published')}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t p-5">
              <Button variant="ghost" onClick={cancel} disabled={saving}>
                {t('cancel')}
              </Button>
              <Button onClick={save} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="me-1 h-4 w-4 animate-spin" />}
                {editingId ? t('save') : t('create')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
