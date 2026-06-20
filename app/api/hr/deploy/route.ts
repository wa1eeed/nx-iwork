import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import {
  hrAgent,
  HRConflictError,
  HRValidationError,
  type DeployPayload,
} from '@/lib/agent/hr-agent';

// POST /api/hr/deploy — the HR Agent's hiring endpoint. Any caller (the add-agent
// UI, or an autonomous CEO agent raising a strategic-hiring request) submits a
// DeployPayload here; the tenant is taken from the session, never the body.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 403 });
  }

  let body: Partial<DeployPayload>;
  try {
    body = (await req.json()) as Partial<DeployPayload>;
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  if (body.source !== 'template' && body.source !== 'custom') {
    return NextResponse.json({ ok: false, reason: 'invalid_source' }, { status: 400 });
  }
  if (!body.departmentId || typeof body.departmentId !== 'string') {
    return NextResponse.json({ ok: false, reason: 'department_required' }, { status: 400 });
  }

  try {
    const agentId = await hrAgent.onboardAndDeployAgent(companyId, body as DeployPayload);
    return NextResponse.json({ ok: true, agentId });
  } catch (err) {
    if (err instanceof HRConflictError) {
      // 409 Conflict — the HR gateway refused a near-duplicate hire.
      return NextResponse.json(
        { ok: false, reason: 'conflict', detail: err.verdict.reason },
        { status: 409 }
      );
    }
    if (err instanceof HRValidationError) {
      return NextResponse.json({ ok: false, reason: err.code }, { status: 400 });
    }
    console.error('POST /api/hr/deploy failed', err);
    return NextResponse.json({ ok: false, reason: 'generic' }, { status: 500 });
  }
}
