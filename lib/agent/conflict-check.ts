// HR conflict check — before a new agent is written, gemini-2.5-flash (managed
// tier HAIKU) reviews the tenant's current org and flags a duplicate role or a
// hard permission/responsibility conflict. Fail-open: any error returns "no
// conflict" so an AI hiccup never blocks the owner from building their team.

import { db } from '@/lib/db';
import { getProviderForCompany } from '@/lib/ai';
import { isManagedMode } from '@/lib/billing/tokens';
import { chargeTokens } from '@/lib/billing/tokens';

export interface ConflictResult {
  conflict: boolean;
  severity: 'none' | 'warning' | 'block';
  reason: string;
}

const NONE: ConflictResult = { conflict: false, severity: 'none', reason: '' };

function parseResult(text: string): ConflictResult {
  // Models sometimes wrap JSON in ```json fences or prose — extract the object.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return NONE;
  try {
    const parsed = JSON.parse(match[0]) as Partial<ConflictResult>;
    const severity =
      parsed.severity === 'block' || parsed.severity === 'warning' ? parsed.severity : 'none';
    return {
      conflict: Boolean(parsed.conflict) && severity !== 'none',
      severity,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : '',
    };
  } catch {
    return NONE;
  }
}

export async function checkRoleConflict(
  companyId: string,
  candidate: { role: string; department: string }
): Promise<ConflictResult> {
  const existing = await db.agent.findMany({
    where: { companyId, status: { not: 'ARCHIVED' } },
    select: { role: true, roleEn: true, department: { select: { name: true } } },
  });
  // First hire can never conflict.
  if (existing.length === 0) return NONE;

  const result = await getProviderForCompany(companyId);
  if (!result.ok) return NONE; // fail-open when no AI is configured

  const roster = existing
    .map((a, i) => `${i + 1}. ${a.roleEn || a.role} (dept: ${a.department.name})`)
    .join('\n');

  const system =
    'You are an HR org-design reviewer for a single company. Decide whether a NEW role ' +
    'duplicates an existing role or creates a hard responsibility/permission conflict. ' +
    'A different department or a clearly distinct scope is NOT a conflict. ' +
    'Respond with ONLY a JSON object: {"conflict":boolean,"severity":"none|warning|block","reason":"one short sentence"}. ' +
    'Use "block" only for an almost-exact duplicate; "warning" for meaningful overlap; otherwise "none".';

  const user =
    `Existing roles:\n${roster}\n\n` +
    `New role to add: "${candidate.role}" in department "${candidate.department}".\n` +
    `Return the JSON verdict.`;

  try {
    const res = await result.provider.complete({
      system,
      messages: [{ role: 'user', content: user }],
      tier: 'HAIKU',
      temperature: 0,
      maxTokens: 200,
      timeoutMs: 12_000,
    });
    if (isManagedMode()) {
      await chargeTokens(companyId, res.usage.inputTokens + res.usage.outputTokens);
    }
    return parseResult(res.text);
  } catch (err) {
    console.error('checkRoleConflict failed (fail-open)', err);
    return NONE;
  }
}
