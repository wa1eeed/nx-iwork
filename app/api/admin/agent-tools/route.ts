import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { getToolsForAgent } from '@/lib/agent/tools';

// Read-only diagnostic: for a company's agents, compute the EXACT tool list the
// dashboard/internal chat (runAgentChat) would offer each one — replicating its
// permission-augmentation — so we can confirm from the LIVE DB whether a given
// tool (e.g. list_customers) actually reaches the model, instead of guessing.
//
// CRON_SECRET-guarded (same as the other admin utilities). Returns only tool
// NAMES + model tier + permission count — no PII. From anywhere:
//   curl "https://<domain>/api/admin/agent-tools?slug=refine&secret=$CRON_SECRET"

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get('x-seed-secret') ?? new URL(req.url).searchParams.get('secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Mirrors the internal-mode allow-list expansion in lib/agent/run.ts (skills are
// omitted — they only ADD tools, so they can't hide list_customers).
function internalPerms(permissions: string[], hasBookings: boolean): string[] {
  if (permissions.length === 0) return []; // empty = all base tools
  const internal = [
    'find_customer', 'search_catalog', 'search_faq', 'create_task',
    'update_task_status', 'save_memory', 'create_output', 'delegate_to_agent',
  ];
  if (hasBookings) {
    internal.push('list_bookings', 'list_open_slots', 'check_availability', 'create_booking', 'update_booking', 'set_booking_staff');
  }
  return Array.from(new Set([...permissions, ...internal]));
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ ok: false, reason: 'missing_slug' }, { status: 400 });

  const company = await db.company.findUnique({
    where: { slug },
    select: {
      id: true, hasEcommerce: true, hasServices: true, hasBookings: true,
      _count: { select: { objectTypes: true } },
      agents: {
        where: { status: { not: 'ARCHIVED' } },
        select: { id: true, name: true, ref: true, model: true, aiModel: true, surface: true, permissions: true },
      },
    },
  });
  if (!company) return NextResponse.json({ ok: false, reason: 'company_not_found' }, { status: 404 });

  const modules = {
    hasEcommerce: company.hasEcommerce,
    hasServices: company.hasServices,
    hasBookings: company.hasBookings,
    hasObjects: company._count.objectTypes > 0,
  };

  const agents = company.agents.map((a) => {
    const perms = internalPerms(a.permissions, company.hasBookings);
    const tools = getToolsForAgent(modules, perms).map((t) => t.name);
    return {
      name: a.name,
      ref: a.ref,
      modelTier: a.model,
      pinnedModel: a.aiModel ?? null,
      surface: a.surface,
      permissionCount: a.permissions.length, // 0 = "all tools"
      toolCount: tools.length,
      hasListCustomers: tools.includes('list_customers'),
      hasFindCustomer: tools.includes('find_customer'),
      tools,
    };
  });

  return NextResponse.json({ ok: true, slug, modules, agents });
}
