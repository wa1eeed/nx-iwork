import { db } from '@/lib/db';
import { ModelsManager, type ModelRow } from '@/components/admin/models-manager';

export const dynamic = 'force-dynamic';

// Platform AI model registry. Enabling a model here makes it selectable for every
// company's agents — no code change to add a newly released Gemini/OpenAI/Claude
// model. (The (admin) layout already gates the whole section to super-admins.)
export default async function AdminModelsPage() {
  const rows = await db.aiModel.findMany({
    orderBy: [{ provider: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    select: { id: true, provider: true, modelId: true, label: true, tier: true, enabled: true, isDefault: true },
  });
  const models: ModelRow[] = rows.map((r) => ({ ...r }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI models</h1>
        <p className="text-sm text-muted-foreground">
          The models available to every company’s agents. Add a new release as a row — no deploy needed.
          Owners pick a model per agent; the “default” is used when none is chosen.
        </p>
      </div>
      <ModelsManager models={models} />
    </div>
  );
}
