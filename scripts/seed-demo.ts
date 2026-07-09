// Semi-realistic demo tenant — "Zahra Home" (the design handoff's example
// company): a home & lifestyle shop running an autonomous AI workforce.
//
// Idempotent: re-running wipes and rebuilds only this demo company's data, so
// it's safe to run repeatedly. It seeds every surface the platform renders —
// departments, agents (with autonomy), customers, products, services, orders,
// invoices, bookings, tasks, pending approvals, timeline, memories, schedules —
// so the Command Center, Sales, Approvals, and agent workspace all come alive.
//
//   DATABASE_URL=postgres://…  npm run seed:demo
//   (optional) DEMO_PASSWORD=…  to set the demo owner's password (default demo1234)
//
// NOTE: a seed intentionally bypasses the HR hiring pipeline (which makes AI
// calls) and writes agents directly — this is demo data, not the app's flow.

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const SLUG = 'zahra-home-demo';
const OWNER_EMAIL = 'owner@zahra.demo';
const OWNER_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo1234';

async function main() {
  const now = new Date();
  const min = (m: number) => new Date(now.getTime() - m * 60_000);
  const hr = (h: number) => new Date(now.getTime() - h * 3_600_000);
  const day = (d: number) => new Date(now.getTime() - d * 86_400_000);
  const ahead = (h: number) => new Date(now.getTime() + h * 3_600_000);

  console.log('▸ Seeding demo tenant "Zahra Home"…');

  // ── Company (upsert by slug) ───────────────────────────────────────────────
  const company = await db.company.upsert({
    where: { slug: SLUG },
    update: {
      plan: 'GROWTH',
      tokenBalance: 4_700_000,
      hasEcommerce: true,
      hasServices: true,
      hasBookings: true,
      automationEnabled: true,
      status: 'ACTIVE',
    },
    create: {
      name: 'Zahra Home',
      nameEn: 'Zahra Home',
      slug: SLUG,
      industry: 'Home & lifestyle retail',
      status: 'ACTIVE',
      plan: 'GROWTH',
      tokenBalance: 4_700_000,
      hasEcommerce: true,
      hasServices: true,
      hasBookings: true,
      automationEnabled: true,
    },
    select: { id: true },
  });
  const companyId = company.id;

  // ── Wipe existing demo children (FK-safe order: referencing rows first) ─────
  await db.approval.deleteMany({ where: { companyId } });
  await db.timelineEvent.deleteMany({ where: { companyId } });
  await db.agentMemory.deleteMany({ where: { companyId } });
  await db.agentSchedule.deleteMany({ where: { companyId } });
  await db.task.deleteMany({ where: { companyId } });
  await db.booking.deleteMany({ where: { companyId } });
  await db.order.deleteMany({ where: { companyId } }); // cascades OrderItems
  await db.invoice.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.product.deleteMany({ where: { companyId } });
  await db.service.deleteMany({ where: { companyId } });
  await db.agent.deleteMany({ where: { companyId } }); // before departments (Restrict)
  await db.department.deleteMany({ where: { companyId } });

  // ── Owner user + settings + wallet + DNA ───────────────────────────────────
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  await db.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { companyId, password: passwordHash, name: 'Zahra (Owner)', role: 'BUSINESS_OWNER' },
    create: {
      email: OWNER_EMAIL,
      name: 'Zahra (Owner)',
      password: passwordHash,
      role: 'BUSINESS_OWNER',
      locale: 'en',
      companyId,
    },
  });

  await db.businessSettings.upsert({
    where: { companyId },
    update: {},
    create: { companyId, primaryLanguage: 'en', currency: 'SAR', timezone: 'Asia/Riyadh', themeMode: 'light' },
  });

  await db.wallet.upsert({
    where: { companyId },
    update: { balance: 8400 },
    create: { companyId, balance: 8400, currency: 'SAR' },
  });

  await db.companyDNA.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      aboutUs: 'Zahra Home designs and sells warm, modern home goods — textiles, lighting, and tableware — with same-week delivery across the Gulf.',
      targetAudience: 'Homeowners and gift-buyers aged 25–45 who value tasteful, affordable design.',
      policies: 'Returns within 14 days. Standard discount cap 10% (owner approval above). Delivery 2–5 days.',
      tone: 'Warm, concise, and helpful.',
    },
  });

  // ── Departments (design accents) ───────────────────────────────────────────
  const deptDefs = [
    { key: 'sales', name: 'Sales', icon: 'briefcase', color: '#16a34a' },
    { key: 'marketing', name: 'Marketing', icon: 'megaphone', color: '#f59e0b' },
    { key: 'support', name: 'Support', icon: 'headphones', color: '#a855f7' },
    { key: 'operations', name: 'Operations', icon: 'cart', color: '#0ea5e9' },
    { key: 'finance', name: 'Finance', icon: 'briefcase', color: '#ca8a04' },
    { key: 'appointments', name: 'Appointments', icon: 'pen-tool', color: '#6366f1' },
  ] as const;

  const dept: Record<string, string> = {};
  for (const d of deptDefs) {
    const row = await db.department.create({
      data: { companyId, name: d.name, nameEn: d.name, icon: d.icon, color: d.color },
      select: { id: true },
    });
    dept[d.key] = row.id;
  }

  // ── Agents (one per department, with autonomy + persona + scoped tools) ─────
  const agentDefs = [
    {
      key: 'faisal', name: 'Faisal A.', role: 'Account Manager', deptKey: 'sales',
      persona: 'Relationship-first. Keeps clients happy and renewing.',
      job: 'Own the sales pipeline: qualify leads, follow up, close orders, and flag any discount above policy for approval.',
      model: 'SONNET' as const, autonomy: 'ASK' as const, ref: 'AGT-001',
      permissions: ['search_catalog', 'find_customer', 'create_lead', 'update_lead', 'create_order', 'create_task', 'request_approval', 'save_memory'],
      kpis: [{ key: 'orders', label: 'Orders closed', target: 40, unit: '/mo' }, { key: 'renewal', label: 'Renewal rate', target: 85, unit: '%' }],
    },
    {
      key: 'sara', name: 'Sara M.', role: 'Marketing Lead', deptKey: 'marketing',
      persona: 'Bold, on-brand campaigns that convert.',
      job: 'Plan and draft campaigns and offers. Any broadcast to customers needs owner approval before it goes out.',
      model: 'SONNET' as const, autonomy: 'ASK' as const, ref: 'AGT-002',
      permissions: ['search_catalog', 'find_customer', 'create_task', 'request_approval', 'save_memory'],
      kpis: [{ key: 'campaigns', label: 'Campaigns', target: 4, unit: '/mo' }],
    },
    {
      key: 'nour', name: 'Nour S.', role: 'Support Specialist', deptKey: 'support',
      persona: 'Calm, fast, and genuinely helpful.',
      job: 'Answer customer questions from the knowledge base, resolve issues, and escalate anything sensitive.',
      model: 'HAIKU' as const, autonomy: 'AUTOPILOT' as const, ref: 'AGT-003',
      permissions: ['search_faq', 'search_catalog', 'find_customer', 'create_task', 'update_task_status', 'save_memory'],
      kpis: [{ key: 'csat', label: 'CSAT', target: 95, unit: '%' }],
    },
    {
      key: 'layla', name: 'Layla H.', role: 'Operations Coordinator', deptKey: 'operations',
      persona: 'Keeps every order on time.',
      job: 'Track orders through fulfilment, update statuses, and keep customers informed.',
      model: 'HAIKU' as const, autonomy: 'ASK' as const, ref: 'AGT-004',
      permissions: ['create_order', 'update_task_status', 'create_task', 'find_customer', 'save_memory'],
      kpis: [{ key: 'ontime', label: 'On-time delivery', target: 97, unit: '%' }],
    },
    {
      key: 'reem', name: 'Reem D.', role: 'Finance Officer', deptKey: 'finance',
      persona: 'Precise with every riyal.',
      job: 'Reconcile invoices and supplier payments. Any payment needs owner approval before release.',
      model: 'OPUS' as const, autonomy: 'ASK' as const, ref: 'AGT-005',
      permissions: ['request_approval', 'create_task', 'save_memory'],
      kpis: [{ key: 'accuracy', label: 'Reconciliation accuracy', target: 100, unit: '%' }],
    },
    {
      key: 'omar', name: 'Omar K.', role: 'Scheduling Assistant', deptKey: 'appointments',
      persona: 'Never double-books, always reminds.',
      job: 'Book and confirm appointments against real availability, and send reminders.',
      model: 'HAIKU' as const, autonomy: 'AUTOPILOT' as const, ref: 'AGT-006',
      permissions: ['check_availability', 'create_booking', 'update_booking', 'find_customer', 'create_task', 'save_memory'],
      kpis: [{ key: 'noshow', label: 'No-show rate', target: 5, unit: '%' }],
    },
  ];

  const agent: Record<string, string> = {};
  for (const a of agentDefs) {
    const row = await db.agent.create({
      data: {
        companyId,
        departmentId: dept[a.deptKey],
        name: a.name,
        nameEn: a.name,
        initial: a.name[0],
        ref: a.ref,
        role: a.role,
        roleEn: a.role,
        persona: a.persona,
        jobDescription: a.job,
        isCustom: false,
        model: a.model,
        autonomy: a.autonomy,
        status: 'ONLINE',
        permissions: a.permissions,
        kpis: a.kpis,
        tokenLimit: 500_000,
        periodTokensUsed: Math.floor(60_000 + Math.random() * 240_000),
        tasksCompleted: Math.floor(8 + Math.random() * 40),
        performanceScore: Math.floor(82 + Math.random() * 16),
      },
      select: { id: true },
    });
    agent[a.key] = row.id;
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  const custDefs = [
    { name: 'Al Rashed Group', email: 'buyer@alrashed.sa', phone: '+966500000001', status: 'NEGOTIATING' as const, agentKey: 'faisal' },
    { name: 'Huda Al-Otaibi', email: 'huda@example.sa', phone: '+966500000002', status: 'WON' as const, agentKey: 'faisal' },
    { name: 'Khalid Noor', email: 'khalid@example.sa', phone: '+966500000003', status: 'INTERESTED' as const, agentKey: 'faisal' },
    { name: 'Mona Suites', email: 'ops@monasuites.sa', phone: '+966500000004', status: 'WON' as const, agentKey: 'layla' },
    { name: 'Sara Interiors', email: 'hello@sarainteriors.sa', phone: '+966500000005', status: 'NEW' as const, agentKey: 'faisal' },
    { name: 'Faisal Homes', email: 'contact@faisalhomes.sa', phone: '+966500000006', status: 'DEFERRED' as const, agentKey: 'faisal' },
    { name: 'Lina Café', email: 'lina@linacafe.sa', phone: '+966500000007', status: 'WON' as const, agentKey: 'omar' },
  ];
  const cust: Record<string, string> = {};
  let cn = 1;
  for (const c of custDefs) {
    const row = await db.customer.create({
      data: {
        companyId,
        ref: `CUS-${String(cn).padStart(3, '0')}`,
        name: c.name,
        email: c.email,
        phone: c.phone,
        status: c.status,
        source: 'agent',
        assignedAgentId: agent[c.agentKey],
      },
      select: { id: true },
    });
    cust[c.name] = row.id;
    cn += 1;
  }

  // ── Products ───────────────────────────────────────────────────────────────
  const prodDefs = [
    { title: 'Linen Throw Blanket', price: 240, desc: 'Soft stonewashed linen, 130×170cm.' },
    { title: 'Ceramic Table Lamp', price: 380, desc: 'Handmade ceramic base with linen shade.' },
    { title: 'Stoneware Dinner Set (12pc)', price: 620, desc: 'Reactive-glaze stoneware for six.' },
    { title: 'Rattan Storage Basket', price: 150, desc: 'Natural rattan with cotton liner.' },
    { title: 'Scented Candle — Oud', price: 95, desc: 'Hand-poured soy wax, 50h burn.' },
    { title: 'Wool Area Rug 160×230', price: 1180, desc: 'Hand-tufted wool in warm tones.' },
  ];
  const prod: { id: string; price: number }[] = [];
  let pn = 1;
  for (const p of prodDefs) {
    const row = await db.product.create({
      data: {
        companyId,
        ref: `PRD-${String(pn).padStart(3, '0')}`,
        title: p.title,
        titleEn: p.title,
        description: p.desc,
        price: p.price,
        stock: -1,
        isActive: true,
        sortOrder: pn,
      },
      select: { id: true },
    });
    prod.push({ id: row.id, price: p.price });
    pn += 1;
  }

  // ── Services (bookable — have durationMin) ──────────────────────────────────
  const svcDefs = [
    { title: 'Home Styling Consultation', price: 350, desc: 'A 60-minute in-home styling session.', durationMin: 60 },
    { title: 'Curtain Measurement & Fitting', price: 200, desc: 'On-site measurement and fitting visit.', durationMin: 45 },
    { title: 'Gift Wrapping (premium)', price: 40, desc: 'Premium wrapping for any order.', durationMin: 15 },
  ];
  const svc: Record<string, string> = {};
  let sn = 1;
  for (const s of svcDefs) {
    const row = await db.service.create({
      data: {
        companyId,
        ref: `SRV-${String(sn).padStart(3, '0')}`,
        title: s.title,
        titleEn: s.title,
        description: s.desc,
        price: s.price,
        durationMin: s.durationMin,
        bufferMin: 15,
        maxCapacity: 1,
        isActive: true,
        sortOrder: sn,
      },
      select: { id: true },
    });
    svc[s.title] = row.id;
    sn += 1;
  }

  // ── Orders (mixed statuses to power the Sales dashboard) ────────────────────
  const orderDefs = [
    { cust: 'Huda Al-Otaibi', items: [[0, 2], [4, 3]], status: 'COMPLETED' as const, days: 12 },
    { cust: 'Mona Suites', items: [[2, 1], [5, 1]], status: 'COMPLETED' as const, days: 9 },
    { cust: 'Lina Café', items: [[1, 4]], status: 'COMPLETED' as const, days: 7 },
    { cust: 'Al Rashed Group', items: [[5, 3], [2, 2]], status: 'CONFIRMED' as const, days: 2 },
    { cust: 'Khalid Noor', items: [[3, 2], [4, 2]], status: 'IN_PROGRESS' as const, days: 1 },
    { cust: 'Sara Interiors', items: [[0, 1], [1, 1]], status: 'NEW' as const, days: 0 },
    { cust: 'Huda Al-Otaibi', items: [[3, 1]], status: 'COMPLETED' as const, days: 20 },
    { cust: 'Mona Suites', items: [[4, 6]], status: 'CANCELLED' as const, days: 5 },
    { cust: 'Khalid Noor', items: [[1, 1], [5, 1]], status: 'COMPLETED' as const, days: 3 },
  ];
  let on = 1;
  for (const o of orderDefs) {
    const items = o.items.map(([idx, qty]) => {
      const p = prod[idx];
      return { productId: p.id, quantity: qty, unitPrice: p.price, total: p.price * qty };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const vat = Math.round(subtotal * 0.15);
    await db.order.create({
      data: {
        companyId,
        orderNumber: `ORD-${String(on).padStart(4, '0')}`,
        type: 'PRODUCT',
        customerId: cust[o.cust],
        customerName: o.cust,
        subtotal,
        vat,
        total: subtotal + vat,
        status: o.status,
        paymentStatus: o.status === 'COMPLETED' ? 'PAID' : 'PENDING',
        agentId: agent.faisal,
        createdAt: day(o.days),
        items: { create: items },
      },
    });
    on += 1;
  }

  // ── Invoices (platform billing) ────────────────────────────────────────────
  const invDefs = [
    { number: 'INV-2026-001', amount: 299, status: 'PAID' as const, days: 35, paid: true },
    { number: 'INV-2026-002', amount: 299, status: 'PAID' as const, days: 5, paid: true },
    { number: 'INV-2026-003', amount: 299, status: 'OPEN' as const, days: 0, paid: false },
  ];
  for (const i of invDefs) {
    const vat = Math.round(i.amount * 0.15);
    await db.invoice.create({
      data: {
        companyId,
        number: i.number,
        amount: i.amount,
        vat,
        total: i.amount + vat,
        status: i.status,
        createdAt: day(i.days),
        paidAt: i.paid ? day(i.days) : null,
      },
    });
  }

  // ── Bookings (upcoming appointments) ───────────────────────────────────────
  const bookDefs = [
    { title: 'Home Styling — Al Rashed', svc: 'Home Styling Consultation', cust: 'Al Rashed Group', inH: 26 },
    { title: 'Curtain fitting — Mona Suites', svc: 'Curtain Measurement & Fitting', cust: 'Mona Suites', inH: 50 },
    { title: 'Styling — Lina Café', svc: 'Home Styling Consultation', cust: 'Lina Café', inH: 74 },
    { title: 'Curtain fitting — Khalid', svc: 'Curtain Measurement & Fitting', cust: 'Khalid Noor', inH: 8 },
  ];
  let bn = 1;
  for (const b of bookDefs) {
    await db.booking.create({
      data: {
        companyId,
        ref: `BKG-${String(bn).padStart(3, '0')}`,
        title: b.title,
        serviceId: svc[b.svc],
        customerId: cust[b.cust],
        startAt: ahead(b.inH),
        endAt: ahead(b.inH + 1),
        status: 'CONFIRMED',
      },
    });
    bn += 1;
  }

  // ── Tasks (done → work log; pending → autonomous queue) ─────────────────────
  const taskDefs = [
    { agentKey: 'faisal', title: 'Follow up with Al Rashed on the bulk order', status: 'DONE' as const, trigger: 'SCHEDULE', result: 'Sent a follow-up and a revised quote; awaiting their sign-off.', ago: 34 },
    { agentKey: 'faisal', title: 'Picked up work from the Sales queue', status: 'DONE' as const, trigger: 'EVENT', result: 'Qualified 3 new leads from the chat widget.', ago: 12 },
    { agentKey: 'nour', title: 'Answer return-policy question (Khalid)', status: 'DONE' as const, trigger: 'USER_MESSAGE', result: 'Explained the 14-day return window and shared the form.', ago: 90 },
    { agentKey: 'layla', title: 'Update fulfilment status for ORD-0004', status: 'WORKING' as const, trigger: 'SCHEDULE', result: null, ago: 3 },
    { agentKey: 'sara', title: 'Draft the Eid home-collection campaign', status: 'PENDING' as const, trigger: 'AGENT_TOOL', result: null, ago: 5 },
    { agentKey: 'omar', title: 'Send reminders for tomorrow’s appointments', status: 'PENDING' as const, trigger: 'AGENT_TOOL', result: null, ago: 2 },
    { agentKey: 'reem', title: 'Reconcile supplier invoice #SUP-2291', status: 'PENDING' as const, trigger: 'EVENT', result: null, ago: 1 },
    { agentKey: 'nour', title: 'Triage new support messages', status: 'DONE' as const, trigger: 'SCHEDULE', result: 'Cleared the queue; 1 escalation opened.', ago: 220 },
  ];
  for (const t of taskDefs) {
    await db.task.create({
      data: {
        companyId,
        agentId: agent[t.agentKey],
        title: t.title,
        description: t.title,
        status: t.status,
        triggerType: t.trigger,
        result: t.result,
        completedAt: t.status === 'DONE' ? min(t.ago) : null,
        createdAt: min(t.ago + 5),
      },
    });
  }

  // ── Pending approvals (design View 3 / Command Center rail) ─────────────────
  const apprDefs = [
    { agentKey: 'faisal', decision: '15% discount · Al Rashed order', context: 'Client requests 15% on a SAR 8,400 order to close today. Policy cap is 10%.' },
    { agentKey: 'reem', decision: 'Pay supplier invoice · SAR 4,200', context: 'Supplier #SUP-2291 payment is over the SAR 500 approval cap.' },
    { agentKey: 'sara', decision: 'Eid campaign → 2,300 customers', context: '“Eid Mubarak from Zahra Home — 20% off across the home collection.” Broadcast to 2,300 opted-in customers.' },
  ];
  for (const a of apprDefs) {
    await db.approval.create({
      data: {
        companyId,
        agentId: agent[a.agentKey],
        decision: a.decision,
        context: a.context,
        options: ['approve', 'reject'],
        status: 'PENDING',
        createdAt: min(20),
      },
    });
  }

  // ── Timeline (Command Center live feed) ─────────────────────────────────────
  const tlDefs = [
    { agentKey: 'faisal', type: 'APPROVAL_REQUESTED' as const, title: 'Faisal A. asked for approval', desc: '15% discount · Al Rashed order', ago: 20 },
    { agentKey: 'nour', type: 'TASK_COMPLETED' as const, title: 'Nour S. resolved a support question', desc: 'Return policy — Khalid', ago: 90 },
    { agentKey: 'sara', type: 'DECISION_NEEDED' as const, title: 'Sara M. is waiting on you', desc: 'Eid campaign broadcast', ago: 25 },
    { agentKey: 'layla', type: 'TASK_STARTED' as const, title: 'Layla H. started a task', desc: 'Fulfilment update · ORD-0004', ago: 3 },
    { agentKey: 'faisal', type: 'TASK_COMPLETED' as const, title: 'Faisal A. qualified new leads', desc: '3 leads from the chat widget', ago: 12 },
    { agentKey: 'omar', type: 'INTEGRATION_TRIGGERED' as const, title: 'Trigger fired — new booking', desc: 'Curtain fitting — Khalid', ago: 8 },
    { agentKey: 'reem', type: 'APPROVAL_REQUESTED' as const, title: 'Reem D. asked for approval', desc: 'Pay supplier · SAR 4,200', ago: 18 },
  ];
  for (const e of tlDefs) {
    await db.timelineEvent.create({
      data: { companyId, agentId: agent[e.agentKey], type: e.type, title: e.title, description: e.desc, createdAt: min(e.ago) },
    });
  }

  // ── Agent memories (semantic layer) ─────────────────────────────────────────
  const memDefs = [
    { agentKey: 'faisal', summary: 'Al Rashed Group negotiates hard but pays on time; they value fast quotes.', category: 'customer', importance: 8 },
    { agentKey: 'faisal', summary: 'Standard discount cap is 10%; anything higher needs owner approval.', category: 'decision', importance: 9 },
    { agentKey: 'nour', summary: 'Returns are accepted within 14 days with the original receipt.', category: 'learning', importance: 7 },
    { agentKey: 'omar', summary: 'Lina Café prefers morning appointments before 10am.', category: 'customer', importance: 6 },
    { agentKey: 'sara', summary: 'The Oud candle and wool rug are the best-performing hero products.', category: 'product', importance: 7 },
  ];
  for (const m of memDefs) {
    await db.agentMemory.create({
      data: { companyId, agentId: agent[m.agentKey], summary: m.summary, category: m.category, importance: m.importance, createdAt: day(2) },
    });
  }

  // ── Agent schedules (recurring autonomous work) ────────────────────────────
  await db.agentSchedule.create({
    data: {
      companyId, agentId: agent.faisal, name: 'Daily pipeline follow-ups', cronExpression: '0 9 * * *',
      timezone: 'Asia/Riyadh', taskTemplate: 'Review the sales pipeline and follow up with any lead that has gone quiet for 3+ days.',
      isActive: true, nextRunAt: ahead(14), runCount: 22,
    },
  });
  await db.agentSchedule.create({
    data: {
      companyId, agentId: agent.omar, name: 'Appointment reminders', cronExpression: '0 18 * * *',
      timezone: 'Asia/Riyadh', taskTemplate: 'Send reminders to every customer with an appointment in the next 24 hours.',
      isActive: true, nextRunAt: ahead(6), runCount: 40,
    },
  });

  console.log(`✓ Demo tenant ready.`);
  console.log(`  Company: Zahra Home  (slug: ${SLUG})`);
  console.log(`  Login:   ${OWNER_EMAIL}  /  ${OWNER_PASSWORD}`);
  console.log(`  Seeded:  6 departments · 6 agents · ${custDefs.length} customers · ${prodDefs.length} products · ${svcDefs.length} services · ${orderDefs.length} orders · ${invDefs.length} invoices · ${bookDefs.length} bookings · ${taskDefs.length} tasks · ${apprDefs.length} approvals`);
}

main()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Demo seed failed:', err);
    await db.$disconnect();
    process.exit(1);
  });
