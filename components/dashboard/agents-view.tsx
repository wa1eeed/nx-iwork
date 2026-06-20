'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrganizationChart, type OrgNode } from '@/components/dashboard/organization-chart';

// Toggles the populated Employees area between the department grid (server-
// rendered, passed as children) and the org chart built from direct_manager_id.
export function AgentsView({ orgNodes, children }: { orgNodes: OrgNode[]; children: ReactNode }) {
  const t = useTranslations('pages.agents');
  const [view, setView] = useState<'grid' | 'chart'>('grid');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border p-0.5 text-sm">
          <button
            onClick={() => setView('grid')}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1', view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {t('gridView')}
          </button>
          <button
            onClick={() => setView('chart')}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1', view === 'chart' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
          >
            <Network className="h-3.5 w-3.5" />
            {t('chartView')}
          </button>
        </div>
      </div>

      {view === 'grid' ? children : <OrganizationChart agents={orgNodes} />}
    </div>
  );
}
