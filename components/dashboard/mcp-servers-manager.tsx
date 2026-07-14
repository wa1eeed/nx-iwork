'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Plug, CheckCircle2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { addMcpServer, removeMcpServer, toggleMcpServer, testMcpServer } from '@/lib/actions/mcp';

export interface McpRow {
  id: string;
  name: string;
  key: string;
  url: string;
  isActive: boolean;
  hasAuth: boolean;
}

const KNOWN_ERR = new Set(['name_required', 'bad_url', 'not_found', 'unauthorized']);

export function McpServersManager({ servers }: { servers: McpRow[] }) {
  const t = useTranslations('pages.integrations');
  const tc = useTranslations('common');
  const router = useRouter();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [adding, startAdd] = useTransition();
  const [testing, startTest] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const errMsg = (code: string) => (KNOWN_ERR.has(code) ? t(`err.${code}`) : code);

  const test = () =>
    startTest(async () => {
      const res = await testMcpServer({ url, authToken });
      if (res.ok) toast.success(t('testOk', { count: res.tools.length }));
      else toast.error(`${t('testFail')}: ${res.error}`);
    });

  const add = () =>
    startAdd(async () => {
      const res = await addMcpServer({ name, url, authToken: authToken || null });
      if (res.ok) {
        toast.success(t('added'));
        setName('');
        setUrl('');
        setAuthToken('');
        router.refresh();
      } else toast.error(errMsg(res.error));
    });

  const toggle = async (row: McpRow) => {
    setBusyId(row.id);
    const res = await toggleMcpServer(row.id, !row.isActive);
    setBusyId(null);
    if (res.ok) router.refresh();
    else toast.error(errMsg(res.error));
  };

  const remove = async (row: McpRow) => {
    if (!(await confirm({ title: t('remove'), description: t('removeConfirm', { name: row.name }), confirmLabel: tc('delete'), destructive: true }))) return;
    setBusyId(row.id);
    const res = await removeMcpServer(row.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(t('removed'));
      router.refresh();
    } else toast.error(errMsg(res.error));
  };

  return (
    <div className="space-y-5">
      {/* Existing servers */}
      {servers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-2 py-10 text-center">
            <Plug className="mx-auto size-8 text-muted-foreground" />
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {servers.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.name}</p>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">mcp__{s.key}__</code>
                    {!s.isActive && <span className="text-xs text-amber-600">{t('inactive')}</span>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground" dir="ltr">{s.url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={s.isActive} onCheckedChange={() => toggle(s)} disabled={busyId === s.id} />
                  <button
                    onClick={() => remove(s)}
                    disabled={busyId === s.id}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label={t('remove')}
                  >
                    {busyId === s.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add form */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="font-medium">{t('addTitle')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('url')}</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" dir="ltr" className="font-mono" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>
              {t('authToken')} <span className="text-xs text-muted-foreground">({t('authOptional')})</span>
            </Label>
            <Input value={authToken} onChange={(e) => setAuthToken(e.target.value)} dir="ltr" className="font-mono" placeholder="Bearer token…" />
            <p className="text-xs text-muted-foreground">{t('authTokenHelp')}</p>
          </div>

          <div className={cn('rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground')}>
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircle2 className="size-3.5 text-primary" />
              {t('grantHint')}
            </p>
            <p className="mt-1">{t('namespaceHint')}</p>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={test} disabled={testing || !url.trim()} className="gap-1">
              {testing ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              {t('test')}
            </Button>
            <Button onClick={add} disabled={adding || !name.trim() || !url.trim()} className="gap-1">
              {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {t('add')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
