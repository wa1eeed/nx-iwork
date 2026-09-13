import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserCompany } from '@/lib/companies';
import { getCommandState } from '@/lib/command/state';

// Live state for the Command Center radar. Polled by the client every few
// seconds. Company-scoped via the impersonation-safe getUserCompany.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, reason: 'unauthenticated' }, { status: 401 });
  }
  const companyId = await getUserCompany(session.user.id);
  if (!companyId) {
    return NextResponse.json({ ok: false, reason: 'no_company' }, { status: 403 });
  }
  const state = await getCommandState(companyId);
  return NextResponse.json({ ok: true, ...state });
}
