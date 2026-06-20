// System agent templates — platform-wide blueprints for hybrid creation.

import { db } from '@/lib/db';

export interface IfThenScenario {
  event: string;
  action: string;
}
export interface AgentKpi {
  key: string;
  label: string;
  target: number;
  unit: string;
}

export async function getActiveTemplates() {
  return db.agentTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getTemplate(templateType: string) {
  return db.agentTemplate.findUnique({ where: { templateType } });
}
