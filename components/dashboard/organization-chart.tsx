'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface OrgNode {
  id: string;
  name: string;
  role: string;
  initial: string;
  ref: string | null;
  status: string;
  parentId: string | null;
  departmentColor: string;
}

const STATUS_DOT: Record<string, string> = {
  ONBOARDING: 'bg-amber-500 animate-pulse',
  ONLINE: 'bg-emerald-500',
  WORKING: 'bg-sky-500',
  PAUSED: 'bg-amber-500',
  OFFLINE: 'bg-muted-foreground/40',
};

export function OrganizationChart({ agents }: { agents: OrgNode[] }) {
  const t = useTranslations('pages.agents');

  // Group by manager; treat a parent that isn't in the set (e.g. archived) as a root.
  const ids = new Set(agents.map((a) => a.id));
  const byParent = new Map<string | null, OrgNode[]>();
  for (const a of agents) {
    const key = a.parentId && ids.has(a.parentId) ? a.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(a);
    byParent.set(key, list);
  }
  const roots = byParent.get(null) ?? [];

  if (agents.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('orgChartEmpty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <ul className="space-y-1">
        {roots.map((node) => (
          <OrgBranch key={node.id} node={node} byParent={byParent} depth={0} statusLabel={(s) => t(`status.${s}`)} />
        ))}
      </ul>
    </div>
  );
}

function OrgBranch({
  node,
  byParent,
  depth,
  statusLabel,
}: {
  node: OrgNode;
  byParent: Map<string | null, OrgNode[]>;
  depth: number;
  statusLabel: (s: string) => string;
}) {
  const children = byParent.get(node.id) ?? [];
  return (
    <li>
      <Link
        href={`/agents/${node.id}`}
        className="group inline-flex min-w-[16rem] items-center gap-3 rounded-lg border bg-card p-2.5 transition hover:border-primary/50"
        style={{ marginInlineStart: depth * 28 }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{ backgroundColor: `${node.departmentColor}22`, color: node.departmentColor }}
        >
          {node.initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{node.name}</span>
            {node.ref && (
              <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground" dir="ltr">
                {node.ref}
              </span>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">{node.role}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[node.status] ?? 'bg-muted-foreground/40')} />
          {statusLabel(node.status)}
        </span>
      </Link>

      {children.length > 0 && (
        <ul className="mt-1 space-y-1 border-s border-dashed" style={{ marginInlineStart: depth * 28 + 18 }}>
          {children.map((child) => (
            <OrgBranch key={child.id} node={child} byParent={byParent} depth={depth + 1} statusLabel={statusLabel} />
          ))}
        </ul>
      )}
    </li>
  );
}
