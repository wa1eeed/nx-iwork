// Demo tenants — three distinct Saudi businesses, each populated end-to-end
// (departments, services, AI agents, customers, bookings, FAQ, outputs, …) so the
// whole platform can be walked section-by-section against realistic data.
//
//   1. عيادة بسمة الرياض   /basma      — dental clinic     (services + bookings + staff)
//   2. دار المعالي للعقارات /almaali    — real-estate office(services + bookings + Data objects)
//   3. خدمتك للخدمات المنزلية /khedmatak — home services    (services + bookings + field staff)
//
// Idempotent: re-running wipes + rebuilds ONLY each demo company's own data (by
// companyId), never touching any other tenant. Runs from a super-admin session
// (lib/actions/admin.ts) — no container terminal or secret needed.
//
// Agents are hired through the REAL gateway hrAgent.onboardAndDeployAgent (per
// CLAUDE.md rule #5), with force:true to skip the conflict AI call; demo-only
// stats (KPIs, performance, usage) are layered on afterwards with db.agent.update.

import bcrypt from 'bcryptjs';
import type { Prisma, LeadStatus, BookingStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { hrAgent } from '@/lib/agent/hr-agent';
import { getArchetype } from '@/lib/agent/archetypes';

// ── Shared types ────────────────────────────────────────────────────────────
interface DeptSpec {
  key: string;
  name: string;
  nameEn: string;
  color: string;
  icon: string;
  landingVisible?: boolean;
  tagline?: string;
}
interface SvcSpec {
  dept: string;
  title: string;
  subtitle: string;
  desc: string;
  price?: number;
  priceLabel?: string;
  durationMin?: number;
}
interface StaffSpec {
  name: string;
  role: string;
  bio: string;
  rate: number;
  target: number;
  bonus?: boolean;
}
interface AgentSpec {
  key: string;
  name: string;
  nameEn: string;
  role: string;
  roleEn: string;
  dept: string;
  archetype: 'front_desk' | 'sales' | 'care' | 'marketing' | 'operations' | 'finance';
  jobDescription: string;
  autonomy?: 'SUGGEST' | 'ASK' | 'AUTOPILOT';
  kpis: Array<{ key: string; label: string; target: number; unit: string }>;
  score: number;
  tasksDone: number;
  tokensUsed: number;
  scenario?: string; // materialized as a LEAD_CREATED trigger
}
interface CustSpec { name: string; status: LeadStatus }
interface BookSpec { svc: string; cust: number; offset: number; status: BookingStatus }
interface OrderSpec { cust: number; total: number; status: 'COMPLETED' | 'CONFIRMED' | 'NEW'; days: number }
interface OutputSpec {
  agent: string;
  type: 'MESSAGE' | 'REPORT' | 'PLAN' | 'CONTENT' | 'ANALYSIS' | 'ACTION_LOG';
  status: 'DRAFT' | 'READY' | 'APPROVED' | 'PUBLISHED';
  title: string;
  body: string;
  daysAgo: number;
}
interface TaskSpec { agent: string; title: string; description: string; status: 'PENDING' | 'DONE' }
interface ObjectSpec {
  key: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  fields: Array<{ key: string; label: string; type: string; required?: boolean; options?: string[] }>;
  records: Record<string, unknown>[];
}
interface CouponSpec { code: string; type: 'PERCENT' | 'FIXED'; value: number; scope: 'ALL' | 'SERVICES' | 'PRODUCTS' | 'BOOKINGS' }
interface ReviewSpec { author: string; rating: number; comment: string | null; pending?: boolean }

interface TenantSpec {
  slug: string;
  name: string;
  nameEn: string;
  industry: string;
  city: string;
  accent: string;
  phone: string;
  ownerEmail: string;
  ownerName: string;
  hasBookings: boolean;
  days: number[]; // 0=Sun … 6=Sat
  windows: { s: string; e: string }[];
  dna: { aboutUs: string; targetAudience: string; policies: string; tone: string };
  hero: { title: string; subtitle: string; about: string; greeting: string };
  departments: DeptSpec[];
  services: SvcSpec[];
  staff: StaffSpec[];
  agents: AgentSpec[];
  faq: Array<{ q: string; a: string; c: string }>;
  coupons: CouponSpec[];
  objects?: ObjectSpec[];
  customers: CustSpec[];
  bookings: BookSpec[];
  orders: OrderSpec[];
  outputs: OutputSpec[];
  tasks: TaskSpec[];
  reviews: ReviewSpec[];
}

// ── Shared helpers ──────────────────────────────────────────────────────────
const NAMES = [
  'عبدالله القحطاني', 'سارة العتيبي', 'محمد الدوسري', 'نوف الشمري', 'خالد الحربي',
  'ريم المطيري', 'فيصل الغامدي', 'أمل السبيعي', 'ناصر العنزي', 'هند الزهراني',
  'تركي الرشيد', 'لمى البلوي', 'ماجد الشهري', 'دانة الخالدي', 'سلطان الدوسري',
  'وجدان القرني', 'بدر السهلي', 'شهد الأحمدي', 'راكان الفيفي', 'جواهر النفيعي',
];

// Ordered, FK-safe wipe of ONE company's data. Referencing rows first.
async function wipeTenant(companyId: string): Promise<void> {
  await db.publicConversation.deleteMany({ where: { companyId } });
  await db.approval.deleteMany({ where: { companyId } });
  await db.timelineEvent.deleteMany({ where: { companyId } });
  await db.chatMessage.deleteMany({ where: { companyId } });
  await db.agentMemory.deleteMany({ where: { companyId } });
  await db.agentOutput.deleteMany({ where: { companyId } });
  await db.agentSchedule.deleteMany({ where: { companyId } });
  await db.eventTrigger.deleteMany({ where: { companyId } });
  await db.taskAttempt.deleteMany({ where: { companyId } });
  await db.task.deleteMany({ where: { companyId } });
  await db.booking.deleteMany({ where: { companyId } });
  await db.review.deleteMany({ where: { companyId } });
  await db.companyHours.deleteMany({ where: { companyId } });
  await db.holiday.deleteMany({ where: { companyId } });
  await db.coupon.deleteMany({ where: { companyId } });
  await db.staffMember.deleteMany({ where: { companyId } });
  await db.invoice.deleteMany({ where: { companyId } });
  await db.customerNote.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.objectRecord.deleteMany({ where: { companyId } });
  await db.objectType.deleteMany({ where: { companyId } });
  await db.order.deleteMany({ where: { companyId } });
  await db.service.deleteMany({ where: { companyId } }); // cascades ServiceAvailability
  await db.agent.deleteMany({ where: { companyId } }); // before departments (Restrict)
  await db.department.deleteMany({ where: { companyId } });
  await db.faqItem.deleteMany({ where: { companyId } });
  await db.sitePage.deleteMany({ where: { companyId } });
}

export interface DemoTenantResult {
  slug: string;
  ownerEmail: string;
  departments: number;
  services: number;
  agents: number;
  customers: number;
  bookings: number;
}

// ── Seed one tenant ─────────────────────────────────────────────────────────
async function seedTenant(spec: TenantSpec, password: string): Promise<DemoTenantResult> {
  const now = new Date();
  const TZ = 'Asia/Riyadh';
  // Convert a business-local wall-clock time to the correct UTC instant (Riyadh
  // is a fixed +3, no DST) so demo bookings land on the real slot grid.
  const zToUtc = (y: number, mo: number, d: number, hh: number, mm: number): Date => {
    const guess = Date.UTC(y, mo - 1, d, hh, mm);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(guess));
    const val = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    let h = val('hour');
    if (h === 24) h = 0;
    const seen = Date.UTC(val('year'), val('month') - 1, val('day'), h, val('minute'));
    return new Date(guess - (seen - guess));
  };
  const isoOf = (dt: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  const openDay = (iso: string) => spec.days.includes(new Date(`${iso}T00:00:00Z`).getUTCDay());
  // A working calendar date `offset` days from today (negative = past), skipping
  // closed days by walking outward.
  const workingDate = (offset: number): string => {
    for (let step = 0; step < 14; step++) {
      const probe = offset + (offset >= 0 ? step : -step);
      const iso = isoOf(new Date(now.getTime() + probe * 86_400_000));
      if (openDay(iso)) return iso;
    }
    return isoOf(new Date(now.getTime() + offset * 86_400_000));
  };
  const slots: Array<[number, number]> = [[10, 0], [11, 30], [13, 0], [16, 30], [18, 0], [19, 30]];
  const slotAt = (i: number, offset: number, durationMin = 60) => {
    const [y, mo, d] = workingDate(offset).split('-').map(Number);
    const [hh, mm] = slots[i % slots.length];
    const startAt = zToUtc(y, mo, d, hh, mm);
    return { startAt, endAt: new Date(startAt.getTime() + durationMin * 60_000) };
  };

  console.log(`▸ Seeding demo tenant "${spec.name}" (/${spec.slug})…`);

  const company = await db.company.upsert({
    where: { slug: spec.slug },
    update: {
      name: spec.name, nameEn: spec.nameEn, industry: spec.industry,
      plan: 'GROWTH', tokenBalance: 5_000_000,
      hasEcommerce: false, hasServices: true, hasBookings: spec.hasBookings,
      automationEnabled: true, status: 'ACTIVE',
    },
    create: {
      name: spec.name, nameEn: spec.nameEn, slug: spec.slug, industry: spec.industry,
      status: 'ACTIVE', plan: 'GROWTH', tokenBalance: 5_000_000,
      hasEcommerce: false, hasServices: true, hasBookings: spec.hasBookings,
      automationEnabled: true,
    },
    select: { id: true },
  });
  const companyId = company.id;

  await wipeTenant(companyId);

  // Owner + settings + wallet + DNA
  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.upsert({
    where: { email: spec.ownerEmail },
    update: { companyId, password: passwordHash, name: spec.ownerName, role: 'BUSINESS_OWNER' },
    create: { email: spec.ownerEmail, name: spec.ownerName, password: passwordHash, role: 'BUSINESS_OWNER', locale: 'ar', companyId },
  });
  await db.businessSettings.upsert({
    where: { companyId },
    update: { primaryLanguage: 'ar', primaryColor: spec.accent, timezone: TZ, currency: 'SAR' },
    create: { companyId, primaryLanguage: 'ar', primaryColor: spec.accent, currency: 'SAR', timezone: TZ, themeMode: 'light' },
  });
  await db.wallet.upsert({ where: { companyId }, update: { balance: 6000 }, create: { companyId, balance: 6000, currency: 'SAR' } });
  await db.companyDNA.upsert({ where: { companyId }, update: spec.dna, create: { companyId, ...spec.dna } });

  // Departments
  const deptId: Record<string, string> = {};
  let di = 1;
  for (const d of spec.departments) {
    const row = await db.department.create({
      data: {
        companyId, name: d.name, nameEn: d.nameEn, icon: d.icon, color: d.color,
        landingVisible: d.landingVisible ?? false, tagline: d.tagline, landingOrder: di,
      },
      select: { id: true },
    });
    deptId[d.key] = row.id;
    di += 1;
  }

  // Services (+ availability windows)
  const svcId: Record<string, string> = {};
  let si = 1;
  for (const s of spec.services) {
    const row = await db.service.create({
      data: {
        companyId, departmentId: deptId[s.dept], ref: `SRV-${String(si).padStart(3, '0')}`,
        title: s.title, subtitle: s.subtitle, description: s.desc,
        price: s.price ?? null, priceLabel: s.priceLabel ?? null,
        durationMin: s.durationMin ?? null, bufferMin: 10, maxCapacity: 1,
        allowWaitlist: true, isActive: true, sortOrder: si,
        ...(s.durationMin
          ? { availability: { create: spec.days.flatMap((day) => spec.windows.map((w) => ({ companyId, dayOfWeek: day, startTime: w.s, endTime: w.e }))) } }
          : {}),
      },
      select: { id: true },
    });
    svcId[s.title] = row.id;
    si += 1;
  }

  // Staff
  const staffIds: string[] = [];
  let sti = 1;
  for (const s of spec.staff) {
    const row = await db.staffMember.create({
      data: {
        companyId, ref: `STF-${String(sti).padStart(3, '0')}`, name: s.name, role: s.role, bio: s.bio,
        commissionType: s.bonus ? 'TARGET_BONUS' : 'PERCENT_SALES', commissionRate: s.rate, monthlyTarget: s.target, isActive: true,
      },
      select: { id: true },
    });
    staffIds.push(row.id);
    sti += 1;
  }

  // FAQ
  for (let i = 0; i < spec.faq.length; i++) {
    const f = spec.faq[i];
    await db.faqItem.create({ data: { companyId, question: f.q, answer: f.a, category: f.c, isActive: true, sortOrder: i + 1 } });
  }

  // Coupons
  if (spec.coupons.length) {
    await db.coupon.createMany({ data: spec.coupons.map((c) => ({ companyId, code: c.code, type: c.type, value: c.value, scope: c.scope, isActive: true })) });
  }

  // Business Objects (e.g. real-estate listings)
  for (const o of spec.objects ?? []) {
    const type = await db.objectType.create({
      data: {
        companyId, key: o.key, name: o.name, nameEn: o.nameEn, icon: o.icon, description: o.description,
        fields: o.fields as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    for (const rec of o.records) {
      await db.objectRecord.create({ data: { companyId, objectTypeId: type.id, data: rec as Prisma.InputJsonValue } });
    }
  }

  // Agents — hired through the real HR gateway (force skips the conflict AI call).
  const agentId: Record<string, string> = {};
  let widgetAgentId: string | null = null;
  for (const a of spec.agents) {
    const id = await hrAgent.onboardAndDeployAgent(companyId, {
      source: 'custom',
      departmentId: deptId[a.dept],
      name: a.name, nameEn: a.nameEn, role: a.role, roleEn: a.roleEn,
      jobDescription: a.jobDescription,
      archetype: a.archetype,
      autonomy: a.autonomy ?? (a.archetype === 'marketing' || a.archetype === 'finance' ? 'SUGGEST' : 'ASK'),
      model: 'SONNET',
      permissions: getArchetype(a.archetype)?.permissions ?? [],
      scenarios: a.scenario ? [{ event: 'LEAD_CREATED', action: a.scenario }] : [],
      force: true,
    });
    // Layer on demo-only performance stats (not part of hiring).
    await db.agent.update({
      where: { id },
      data: {
        kpis: a.kpis as unknown as Prisma.InputJsonValue,
        performanceScore: a.score, tasksCompleted: a.tasksDone, periodTokensUsed: a.tokensUsed,
      },
    });
    agentId[a.key] = id;
    if (!widgetAgentId && getArchetype(a.archetype)?.surface === 'CUSTOMER_FACING') widgetAgentId = id;
  }

  // Customers (assigned to the front-desk/widget agent)
  const custId: string[] = [];
  let ci = 1;
  for (const c of spec.customers) {
    const row = await db.customer.create({
      data: {
        companyId, ref: `CUS-${String(ci).padStart(3, '0')}`, name: c.name,
        phone: `+96650${String(1000000 + ci * 37).slice(-7)}`, status: c.status, source: 'website',
        assignedAgentId: widgetAgentId ?? undefined,
      },
      select: { id: true },
    });
    custId.push(row.id);
    ci += 1;
  }

  // Bookings (past = COMPLETED history, future = CONFIRMED/PENDING)
  let bi = 1;
  for (const b of spec.bookings) {
    const svc = svcId[b.svc];
    if (!svc) { bi += 1; continue; }
    const { startAt, endAt } = slotAt(bi, b.offset);
    await db.booking.create({
      data: {
        companyId, ref: `BKG-${String(bi).padStart(3, '0')}`,
        title: `${b.svc} — ${spec.customers[b.cust]?.name ?? ''}`.trim(),
        serviceId: svc, customerId: custId[b.cust] ?? undefined,
        staffMemberId: staffIds.length ? staffIds[(bi - 1) % staffIds.length] : undefined,
        startAt, endAt, status: b.status,
      },
    });
    bi += 1;
  }

  // Completed + open service orders (power Sales revenue). orderNumber is globally
  // unique, so prefix it with the tenant slug.
  let oi = 1;
  for (const o of spec.orders) {
    const vat = Math.round(o.total * 0.15);
    await db.order.create({
      data: {
        companyId, orderNumber: `${spec.slug.toUpperCase()}-${String(1000 + oi)}`, type: 'SERVICE',
        customerId: custId[o.cust] ?? undefined, customerName: spec.customers[o.cust]?.name ?? 'عميل',
        subtotal: o.total, vat, total: o.total + vat,
        status: o.status, paymentStatus: o.status === 'COMPLETED' ? 'PAID' : 'PENDING',
        staffMemberId: staffIds.length ? staffIds[(oi - 1) % staffIds.length] : undefined,
        createdAt: new Date(now.getTime() - o.days * 86_400_000),
      },
    });
    oi += 1;
  }

  // A few in-flight agent tasks (populate Agent Work queue)
  for (const t of spec.tasks) {
    await db.task.create({
      data: {
        companyId, agentId: agentId[t.agent] ?? null, title: t.title, description: t.description,
        triggerType: 'manual', kind: 'AGENT_TASK', status: t.status,
        ...(t.status === 'DONE' ? { completedAt: new Date(now.getTime() - 86_400_000) } : {}),
      },
    });
  }

  // Agent deliverables (populate the Workspace / outputs hub)
  for (const o of spec.outputs) {
    await db.agentOutput.create({
      data: {
        companyId, agentId: agentId[o.agent] ?? widgetAgentId!, type: o.type, status: o.status,
        title: o.title, body: o.body, createdAt: new Date(now.getTime() - o.daysAgo * 86_400_000),
      },
    });
  }

  // Company hours + a national holiday
  if (spec.hasBookings) {
    await db.companyHours.createMany({
      data: spec.days.flatMap((d) => spec.windows.map((w) => ({ companyId, dayOfWeek: d, startTime: w.s, endTime: w.e }))),
    });
    await db.holiday.create({ data: { companyId, date: `${now.getFullYear()}-09-23`, name: 'اليوم الوطني' } });
  }

  // Website config (storefront + chat widget)
  const websiteData = {
    heroTitle: spec.hero.title, heroSubtitle: spec.hero.subtitle,
    aboutTitle: `عن ${spec.name}`, aboutContent: spec.hero.about,
    phone: spec.phone, whatsapp: spec.phone, address: `${spec.city}، المملكة العربية السعودية`,
    chatEnabled: true, chatAgentId: widgetAgentId, chatGreeting: spec.hero.greeting,
    showServices: true, showAbout: true, showContact: true,
  };
  await db.websiteConfig.upsert({ where: { companyId }, update: websiteData, create: { companyId, ...websiteData } });

  // Reviews
  if (spec.reviews.length) {
    await db.review.createMany({
      data: spec.reviews.map((r) => ({ companyId, authorName: r.author, rating: r.rating, comment: r.comment, status: r.pending ? 'PENDING' as const : 'PUBLISHED' as const })),
    });
  }

  console.log(`✓ ${spec.name}: ${spec.departments.length} depts · ${spec.services.length} services · ${spec.agents.length} agents · ${spec.customers.length} customers`);
  return {
    slug: spec.slug, ownerEmail: spec.ownerEmail,
    departments: spec.departments.length, services: spec.services.length,
    agents: spec.agents.length, customers: spec.customers.length, bookings: spec.bookings.length,
  };
}

// ── The three business specs ────────────────────────────────────────────────
import { DENTAL, REAL_ESTATE, HOME_SERVICES } from './demo-tenants.data';

const SPECS: Record<string, TenantSpec> = {
  basma: DENTAL,
  almaali: REAL_ESTATE,
  khedmatak: HOME_SERVICES,
};

export interface SeedDemoResult {
  ok: true;
  tenants: DemoTenantResult[];
}

// Seed all three demo tenants (or one, when `only` is a known slug).
export async function seedDemoTenants(
  opts: { only?: string; password?: string } = {}
): Promise<SeedDemoResult> {
  const password = opts.password ?? process.env.DEMO_PASSWORD ?? 'demo1234';
  const specs = opts.only && SPECS[opts.only] ? [SPECS[opts.only]] : Object.values(SPECS);
  const tenants: DemoTenantResult[] = [];
  for (const spec of specs) {
    tenants.push(await seedTenant(spec, password));
  }
  return { ok: true, tenants };
}

export type { TenantSpec };
