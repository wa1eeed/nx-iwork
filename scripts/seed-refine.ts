// Real-client demo tenant — "مجمع ريفاين الطبي" (Refine Medical Complex, Onaizah,
// Al-Qassim). Mirrors the client's actual clinics + services from refine.sa so the
// platform can be shown to them populated with their own business:
//   • Clinics (departments, landing-visible): Dentistry, Dermatology & skin,
//     Laser, Cosmetic & injectables — each with bookable services (real slots).
//   • A customer-service AI agent wired to the website chat widget (books against
//     real availability, collects the customer's details first).
//   • Human medical staff (with bios), FAQ, footer content pages, coupons, and a
//     handful of customers/bookings/orders so every dashboard comes alive.
//
// Idempotent: re-running wipes and rebuilds ONLY this company's data.
//
//   DATABASE_URL=postgres://…  npm run seed:refine
//   (optional) DEMO_PASSWORD=…  to set the owner's password (default refine1234)
//
// NOTE: a seed intentionally bypasses the HR hiring pipeline (which makes AI
// calls) and writes the agent directly — this is demo data, not the app's flow.

import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const SLUG = 'refine';
const OWNER_EMAIL = 'owner@refine.sa';
const OWNER_PASSWORD = process.env.DEMO_PASSWORD ?? 'refine1234';
const ACCENT = '#0d9488'; // refined teal — clinical + elegant
const PHONE = '+966563232514';

// Clinic hours: Sat–Thu, two windows; Friday closed. (0=Sun … 6=Sat)
const DAYS = [6, 0, 1, 2, 3, 4];
const WINDOWS = [
  { s: '11:00', e: '14:00' },
  { s: '16:00', e: '22:00' },
];

async function main() {
  const now = new Date();
  const day = (d: number) => new Date(now.getTime() - d * 86_400_000);
  const ahead = (h: number) => new Date(now.getTime() + h * 3_600_000);

  console.log('▸ Seeding client demo "مجمع ريفاين الطبي"…');

  const company = await db.company.upsert({
    where: { slug: SLUG },
    update: {
      name: 'مجمع ريفاين الطبي',
      nameEn: 'Refine Medical Complex',
      plan: 'GROWTH',
      tokenBalance: 5_000_000,
      hasEcommerce: false,
      hasServices: true,
      hasBookings: true,
      automationEnabled: true,
      status: 'ACTIVE',
    },
    create: {
      name: 'مجمع ريفاين الطبي',
      nameEn: 'Refine Medical Complex',
      slug: SLUG,
      industry: 'مجمع طبي وتجميلي',
      status: 'ACTIVE',
      plan: 'GROWTH',
      tokenBalance: 5_000_000,
      hasEcommerce: false,
      hasServices: true,
      hasBookings: true,
      automationEnabled: true,
    },
    select: { id: true },
  });
  const companyId = company.id;

  // ── Wipe this company's data (FK-safe order) ───────────────────────────────
  await db.publicConversation.deleteMany({ where: { companyId } });
  await db.approval.deleteMany({ where: { companyId } });
  await db.timelineEvent.deleteMany({ where: { companyId } });
  await db.agentMemory.deleteMany({ where: { companyId } });
  await db.agentSchedule.deleteMany({ where: { companyId } });
  await db.task.deleteMany({ where: { companyId } });
  await db.booking.deleteMany({ where: { companyId } });
  await db.order.deleteMany({ where: { companyId } });
  await db.coupon.deleteMany({ where: { companyId } });
  await db.staffMember.deleteMany({ where: { companyId } });
  await db.invoice.deleteMany({ where: { companyId } });
  await db.customer.deleteMany({ where: { companyId } });
  await db.service.deleteMany({ where: { companyId } }); // cascades ServiceAvailability
  await db.agent.deleteMany({ where: { companyId } }); // before departments (Restrict)
  await db.department.deleteMany({ where: { companyId } });
  await db.faqItem.deleteMany({ where: { companyId } });
  await db.sitePage.deleteMany({ where: { companyId } });

  // ── Owner + settings + DNA + wallet ────────────────────────────────────────
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  await db.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { companyId, password: passwordHash, name: 'مالك ريفاين', role: 'BUSINESS_OWNER' },
    create: {
      email: OWNER_EMAIL,
      name: 'مالك ريفاين',
      password: passwordHash,
      role: 'BUSINESS_OWNER',
      locale: 'ar',
      companyId,
    },
  });

  await db.businessSettings.upsert({
    where: { companyId },
    update: { primaryLanguage: 'ar', primaryColor: ACCENT, timezone: 'Asia/Riyadh', currency: 'SAR' },
    create: {
      companyId,
      primaryLanguage: 'ar',
      primaryColor: ACCENT,
      currency: 'SAR',
      timezone: 'Asia/Riyadh',
      themeMode: 'light',
    },
  });

  await db.wallet.upsert({
    where: { companyId },
    update: { balance: 6500 },
    create: { companyId, balance: 6500, currency: 'SAR' },
  });

  await db.companyDNA.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      aboutUs:
        'مجمع ريفاين الطبي في عنيزة بمنطقة القصيم — وجهتك المتكاملة للأسنان والجلدية والليزر والتجميل، بكادر طبي متخصص وأحدث الأجهزة، في أجواء راقية تليق بك.',
      targetAudience: 'الباحثون عن رعاية طبية وتجميلية عالية الجودة في القصيم.',
      policies:
        'الحجز المسبق مطلوب. يمكن التأجيل قبل الموعد بـ 24 ساعة. الأسعار تبدأ من القيم المذكورة وتُحدَّد نهائياً بعد الكشف.',
      tone: 'راقٍ، ودود، ومطمئن — بلغة عربية واضحة.',
    },
  });

  // ── Clinics (landing-visible departments) ──────────────────────────────────
  const clinicDefs = [
    { key: 'dental', name: 'عيادة الأسنان', color: '#0ea5e9', icon: 'pen-tool', tagline: 'ابتسامة صحية بأحدث تقنيات طب وتجميل الأسنان.' },
    { key: 'derma', name: 'عيادة الجلدية والبشرة', color: '#14b8a6', icon: 'search', tagline: 'علاج ونضارة لبشرتك بأيدٍ متخصصة.' },
    { key: 'laser', name: 'عيادة الليزر', color: '#a855f7', icon: 'megaphone', tagline: 'إزالة الشعر وتجديد البشرة بأحدث أجهزة الليزر.' },
    { key: 'cosmetic', name: 'عيادة التجميل والحقن', color: '#ec4899', icon: 'briefcase', tagline: 'فيلر وبوتكس وإبر نضارة بلمسة طبيعية.' },
  ] as const;

  const clinic: Record<string, string> = {};
  let ci = 1;
  for (const c of clinicDefs) {
    const row = await db.department.create({
      data: {
        companyId,
        name: c.name,
        icon: c.icon,
        color: c.color,
        landingVisible: true,
        tagline: c.tagline,
        landingOrder: ci,
      },
      select: { id: true },
    });
    clinic[c.key] = row.id;
    ci += 1;
  }
  // Back-office unit that houses the AI receptionist (hidden from the website).
  const reception = await db.department.create({
    data: { companyId, name: 'الاستقبال والدعم', icon: 'headphones', color: '#64748b', landingVisible: false },
    select: { id: true },
  });

  // ── AI customer-service agent (the website chat widget) ─────────────────────
  const agent = await db.agent.create({
    data: {
      companyId,
      departmentId: reception.id,
      name: 'مساعد ريفاين',
      nameEn: 'Refine Assistant',
      initial: 'ر',
      ref: 'AGT-001',
      role: 'خدمة العملاء والحجوزات',
      roleEn: 'Reception & Bookings',
      persona: 'راقٍ ومطمئن، يرحّب بالعميل ويجيب بدقة عن الخدمات والأسعار ويكمل الحجز خطوة بخطوة.',
      jobDescription:
        'استقبال زوّار الموقع: الإجابة عن الخدمات والأسعار من الكتالوج، وحجز المواعيد مقابل التوفّر الحقيقي بعد أخذ اسم العميل ورقم جواله، والتحقق من كونه عميلاً مسجّلاً. لا تخترع أوقاتاً ولا أسعاراً.',
      isCustom: false,
      model: 'SONNET',
      autonomy: 'ASK',
      status: 'ONLINE',
      permissions: [
        'search_catalog',
        'search_faq',
        'find_customer',
        'create_lead',
        'check_availability',
        'list_open_slots',
        'create_booking',
        'update_booking',
        'create_task',
        'save_memory',
        'request_approval',
      ],
      kpis: [
        { key: 'bookings', label: 'مواعيد محجوزة', target: 120, unit: '/شهر' },
        { key: 'response', label: 'سرعة الرد', target: 60, unit: 'ثانية' },
      ],
      tokenLimit: 800_000,
      periodTokensUsed: 90_000,
      tasksCompleted: 34,
      performanceScore: 94,
    },
    select: { id: true },
  });

  // ── Services (bookable, grouped under clinics) ─────────────────────────────
  type Svc = {
    clinic: keyof typeof clinic;
    title: string;
    subtitle: string;
    desc: string;
    price?: number;
    priceLabel?: string;
    durationMin: number;
  };
  const svcDefs: Svc[] = [
    // Dentistry
    { clinic: 'dental', title: 'كشف وتشخيص الأسنان', subtitle: 'فحص شامل وخطة علاج', desc: 'كشف شامل لحالة الأسنان واللثة مع خطة علاج واضحة ومناقشة الخيارات.', price: 100, durationMin: 20 },
    { clinic: 'dental', title: 'تنظيف وتلميع الأسنان', subtitle: 'إزالة الجير والتصبغات', desc: 'جلسة تنظيف احترافية لإزالة الجير والتصبغات وتلميع الأسنان لابتسامة أنظف وأنعم.', price: 250, durationMin: 30 },
    { clinic: 'dental', title: 'حشوة تجميلية', subtitle: 'حشوات بلون الأسنان', desc: 'علاج التسوّس بحشوات ضوئية بلون الأسنان الطبيعي تدوم طويلاً.', price: 200, durationMin: 30 },
    { clinic: 'dental', title: 'تبييض الأسنان بالليزر', subtitle: 'ابتسامة أنصع بجلسة واحدة', desc: 'تبييض احترافي بالليزر يمنحك درجات أفتح في جلسة واحدة بنتائج آمنة.', price: 900, durationMin: 60 },
    { clinic: 'dental', title: 'تركيب تيجان وعدسات', subtitle: 'ابتسامة هوليوود', desc: 'تصميم ابتسامة متكامل بعدسات وتيجان تجميلية بأعلى معايير الجودة.', priceLabel: 'تبدأ من 1500 ر.س', durationMin: 60 },
    { clinic: 'dental', title: 'زراعة الأسنان', subtitle: 'تعويض الأسنان المفقودة', desc: 'زراعة أسنان بأنظمة عالمية لتعويض الأسنان المفقودة بثبات ومظهر طبيعي.', priceLabel: 'تبدأ من 2500 ر.س', durationMin: 60 },

    // Dermatology & skin
    { clinic: 'derma', title: 'كشف جلدية', subtitle: 'استشارة وتشخيص', desc: 'استشارة جلدية متخصصة لتشخيص حالة البشرة ووضع خطة علاج مناسبة.', price: 100, durationMin: 20 },
    { clinic: 'derma', title: 'تنظيف البشرة العميق (هيدرافيشل)', subtitle: 'نضارة وترطيب فوري', desc: 'تنظيف عميق وترطيب للبشرة بتقنية الهيدرافيشل لإشراقة فورية.', price: 400, durationMin: 45 },
    { clinic: 'derma', title: 'علاج التصبغات والكلف', subtitle: 'توحيد لون البشرة', desc: 'بروتوكول علاجي لتفتيح التصبغات والكلف وتوحيد لون البشرة تدريجياً.', price: 500, durationMin: 30 },
    { clinic: 'derma', title: 'تقشير بارد للوجه', subtitle: 'تجديد وإشراقة', desc: 'تقشير بارد لطيف يجدّد خلايا البشرة ويمنحها نضارة دون فترة نقاهة.', price: 350, durationMin: 30 },
    { clinic: 'derma', title: 'علاج حب الشباب وآثاره', subtitle: 'بشرة أصفى', desc: 'خطة علاجية لحب الشباب وآثاره لاستعادة نعومة البشرة وصفائها.', price: 450, durationMin: 30 },

    // Laser
    { clinic: 'laser', title: 'ليزر إزالة الشعر — كامل الجسم', subtitle: 'جلسة كاملة', desc: 'إزالة الشعر لكامل الجسم بأحدث أجهزة الليزر الآمنة لكل أنواع البشرة.', priceLabel: 'تبدأ من 600 ر.س', durationMin: 60 },
    { clinic: 'laser', title: 'ليزر إزالة الشعر — الوجه', subtitle: 'جلسة سريعة', desc: 'جلسة ليزر لمنطقة الوجه بنتائج فعّالة وراحة تامة.', price: 200, durationMin: 20 },
    { clinic: 'laser', title: 'ليزر إزالة الشعر — منطقتين', subtitle: 'باقة منطقتين', desc: 'جلسة ليزر لمنطقتين من اختيارك بسعر مميز.', price: 250, durationMin: 30 },
    { clinic: 'laser', title: 'ليزر تفتيح المناطق الحساسة', subtitle: 'عناية متخصصة', desc: 'جلسة تفتيح آمنة للمناطق الحساسة بإشراف متخصص.', price: 300, durationMin: 30 },
    { clinic: 'laser', title: 'ليزر تجديد البشرة (البروتون)', subtitle: 'نضارة وتوحيد اللون', desc: 'جلسة بروتون لتجديد البشرة وتحسين ملمسها وتوحيد لونها.', price: 500, durationMin: 45 },

    // Cosmetic & injectables
    { clinic: 'cosmetic', title: 'بوتكس الوجه', subtitle: 'علاج التجاعيد', desc: 'حقن بوتكس لعلاج التجاعيد وخطوط التعبير بنتائج طبيعية.', priceLabel: 'تبدأ من 800 ر.س', durationMin: 30 },
    { clinic: 'cosmetic', title: 'فيلر الشفايف', subtitle: 'نفخ ونحت طبيعي', desc: 'فيلر للشفاه لإضافة حجم وتناسق بمظهر طبيعي يناسب ملامحك.', priceLabel: 'تبدأ من 1000 ر.س', durationMin: 45 },
    { clinic: 'cosmetic', title: 'فيلر الخدود والذقن', subtitle: 'نحت الوجه', desc: 'نحت وتحديد ملامح الوجه بالفيلر لمظهر متناسق وشبابي.', priceLabel: 'تبدأ من 1200 ر.س', durationMin: 45 },
    { clinic: 'cosmetic', title: 'إبر النضارة', subtitle: 'ترطيب وإشراق عميق', desc: 'إبر نضارة (ميزوثيرابي) لترطيب البشرة من العمق ومنحها إشراقة صحية.', price: 700, durationMin: 30 },
    { clinic: 'cosmetic', title: 'خيوط شد الوجه', subtitle: 'شد بدون جراحة', desc: 'شد ورفع ملامح الوجه بالخيوط دون جراحة مع نتائج فورية.', priceLabel: 'تبدأ من 1500 ر.س', durationMin: 60 },
  ];

  const svc: Record<string, string> = {};
  let sn = 1;
  for (const s of svcDefs) {
    const row = await db.service.create({
      data: {
        companyId,
        departmentId: clinic[s.clinic],
        ref: `SRV-${String(sn).padStart(3, '0')}`,
        title: s.title,
        subtitle: s.subtitle,
        description: s.desc,
        price: s.price ?? null,
        priceLabel: s.priceLabel ?? null,
        durationMin: s.durationMin,
        bufferMin: 10,
        maxCapacity: 1,
        allowWaitlist: true,
        isActive: true,
        sortOrder: sn,
        availability: {
          create: DAYS.flatMap((d) =>
            WINDOWS.map((w) => ({ companyId, dayOfWeek: d, startTime: w.s, endTime: w.e }))
          ),
        },
      },
      select: { id: true },
    });
    svc[s.title] = row.id;
    sn += 1;
  }

  // ── Human medical staff (with bios) ────────────────────────────────────────
  const staffDefs = [
    { ref: 'STF-001', name: 'د. أحمد الشمري', role: 'استشاري وتجميل الأسنان', bio: 'استشاري طب وتجميل الأسنان بخبرة تزيد على 12 عاماً في زراعة الأسنان وتصميم الابتسامة.', type: 'PERCENT_SALES' as const, rate: 10, target: 60000 },
    { ref: 'STF-002', name: 'د. نورة القحطاني', role: 'أخصائية جلدية وليزر', bio: 'أخصائية أمراض جلدية وعلاج بالليزر، متخصصة في علاج التصبغات والعناية بالبشرة.', type: 'PERCENT_SALES' as const, rate: 10, target: 45000 },
    { ref: 'STF-003', name: 'أ. ريم العتيبي', role: 'أخصائية تجميل وعناية بالبشرة', bio: 'أخصائية عناية بالبشرة وجلسات النضارة والتقشير، تحرص على تجربة مريحة وراقية.', type: 'PERCENT_SALES' as const, rate: 8, target: 30000 },
    { ref: 'STF-004', name: 'د. خالد المطيري', role: 'استشاري زراعة الأسنان', bio: 'استشاري جراحة الفم وزراعة الأسنان، معتمد في أحدث أنظمة الزراعة العالمية.', type: 'TARGET_BONUS' as const, rate: 2000, target: 50000 },
  ];
  const staff: string[] = [];
  for (const s of staffDefs) {
    const row = await db.staffMember.create({
      data: {
        companyId,
        ref: s.ref,
        name: s.name,
        role: s.role,
        bio: s.bio,
        commissionType: s.type,
        commissionRate: s.rate,
        monthlyTarget: s.target,
        isActive: true,
      },
      select: { id: true },
    });
    staff.push(row.id);
  }

  // ── FAQ (so the agent answers accurately, not from guesses) ─────────────────
  const faqDefs = [
    { q: 'ما هي مواعيد العمل؟', a: 'من السبت إلى الخميس، فترتان: 11 صباحاً – 2 ظهراً و 4 عصراً – 10 مساءً. الجمعة إجازة.', c: 'مواعيد' },
    { q: 'أين يقع المجمع؟', a: 'عنيزة، حي المنار، منطقة القصيم.', c: 'الموقع' },
    { q: 'كيف أحجز موعداً؟', a: 'يمكنك الحجز مباشرة من الموقع أو عبر الواتساب. يُفضّل الحضور قبل الموعد بـ 10 دقائق.', c: 'الحجز' },
    { q: 'هل يمكن تأجيل أو إلغاء الموعد؟', a: 'نعم، يمكن التأجيل أو الإلغاء قبل الموعد بـ 24 ساعة.', c: 'الحجز' },
    { q: 'ما وسائل الدفع المتاحة؟', a: 'نقبل الدفع نقداً وعبر الشبكة (مدى) والبطاقات.', c: 'الدفع' },
  ];
  for (let i = 0; i < faqDefs.length; i++) {
    const f = faqDefs[i];
    await db.faqItem.create({
      data: { companyId, question: f.q, answer: f.a, category: f.c, isActive: true, sortOrder: i + 1 },
    });
  }

  // ── Website content pages (footer / menu) ──────────────────────────────────
  const pageDefs = [
    {
      title: 'تعليمات قبل وبعد الجلسات',
      slug: 'instructions',
      inNav: true,
      content:
        '## قبل الجلسة\n- تجنّب التعرّض المباشر للشمس قبل جلسات الليزر بـ 48 ساعة.\n- أبلغنا بأي أدوية أو حساسية لديك.\n- احضر بوجهٍ نظيف وخالٍ من المكياج لجلسات البشرة.\n\n## بعد الجلسة\n- استخدم واقي الشمس يومياً.\n- تجنّب المنتجات القوية لمدة 24–48 ساعة.\n- للاستفسار تواصل معنا عبر الواتساب.',
    },
    {
      title: 'الشروط والأحكام',
      slug: 'terms',
      inNav: false,
      content:
        '## الحجز والمواعيد\nالحجز المسبق مطلوب، ويمكن التأجيل قبل الموعد بـ 24 ساعة.\n\n## الأسعار\nالأسعار المعروضة تبدأ من القيم المذكورة، وتُحدَّد التكلفة النهائية بعد الكشف والتشخيص.\n\n## الخصوصية\nنحافظ على سرّية بيانات مراجعينا ولا نشاركها مع أي جهة.',
    },
    {
      title: 'سياسة الخصوصية',
      slug: 'privacy',
      inNav: false,
      content:
        'نلتزم في مجمع ريفاين الطبي بحماية خصوصية بيانات مراجعينا. تُستخدم بياناتك لغرض الحجز والتواصل وتقديم الخدمة فقط، ولا تُشارك مع أي طرف ثالث دون موافقتك.',
    },
  ];
  for (let i = 0; i < pageDefs.length; i++) {
    const p = pageDefs[i];
    await db.sitePage.create({
      data: {
        companyId,
        title: p.title,
        slug: p.slug,
        content: p.content,
        showInFooter: true,
        showInNav: p.inNav,
        isPublished: true,
        sortOrder: i + 1,
      },
    });
  }

  // ── Coupons (Refine runs frequent offers) ──────────────────────────────────
  await db.coupon.createMany({
    data: [
      { companyId, code: 'WELCOME15', type: 'PERCENT', value: 15, scope: 'ALL', isActive: true },
      { companyId, code: 'REFINE20', type: 'PERCENT', value: 20, scope: 'SERVICES', maxRedemptions: 200, isActive: true },
    ],
  });

  // ── Customers ──────────────────────────────────────────────────────────────
  const custDefs = [
    { name: 'سارة العتيبي', phone: '+966500000011', status: 'WON' as const },
    { name: 'محمد الدوسري', phone: '+966500000012', status: 'INTERESTED' as const },
    { name: 'نوف الشمري', phone: '+966500000013', status: 'WON' as const },
    { name: 'عبدالله القحطاني', phone: '+966500000014', status: 'NEW' as const },
    { name: 'ريم المطيري', phone: '+966500000015', status: 'NEGOTIATING' as const },
    { name: 'خالد الحربي', phone: '+966500000016', status: 'WON' as const },
  ];
  const cust: Record<string, string> = {};
  let cn = 1;
  for (const c of custDefs) {
    const row = await db.customer.create({
      data: {
        companyId,
        ref: `CUS-${String(cn).padStart(3, '0')}`,
        name: c.name,
        phone: c.phone,
        status: c.status,
        source: 'website',
        assignedAgentId: agent.id,
      },
      select: { id: true },
    });
    cust[c.name] = row.id;
    cn += 1;
  }

  // ── Upcoming bookings (power the Overview + calendar) ───────────────────────
  const bookDefs = [
    { title: 'تبييض أسنان — سارة العتيبي', svc: 'تبييض الأسنان بالليزر', cust: 'سارة العتيبي', inH: 6 },
    { title: 'هيدرافيشل — نوف الشمري', svc: 'تنظيف البشرة العميق (هيدرافيشل)', cust: 'نوف الشمري', inH: 22 },
    { title: 'ليزر إزالة الشعر — ريم المطيري', svc: 'ليزر إزالة الشعر — كامل الجسم', cust: 'ريم المطيري', inH: 27 },
    { title: 'كشف أسنان — عبدالله القحطاني', svc: 'كشف وتشخيص الأسنان', cust: 'عبدالله القحطاني', inH: 30 },
    { title: 'بوتكس — خالد الحربي', svc: 'بوتكس الوجه', cust: 'خالد الحربي', inH: 49 },
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
        staffMemberId: staff[(bn - 1) % staff.length],
        startAt: ahead(b.inH),
        endAt: ahead(b.inH + 1),
        status: 'CONFIRMED',
      },
    });
    bn += 1;
  }

  // ── Completed service orders (power Sales revenue) ─────────────────────────
  const orderDefs = [
    { cust: 'سارة العتيبي', total: 250, status: 'COMPLETED' as const, days: 10 },
    { cust: 'نوف الشمري', total: 400, status: 'COMPLETED' as const, days: 7 },
    { cust: 'خالد الحربي', total: 900, status: 'COMPLETED' as const, days: 5 },
    { cust: 'محمد الدوسري', total: 200, status: 'COMPLETED' as const, days: 3 },
    { cust: 'ريم المطيري', total: 600, status: 'CONFIRMED' as const, days: 1 },
    { cust: 'عبدالله القحطاني', total: 100, status: 'NEW' as const, days: 0 },
  ];
  let on = 1;
  for (const o of orderDefs) {
    const subtotal = o.total;
    const vat = Math.round(subtotal * 0.15);
    await db.order.create({
      data: {
        companyId,
        orderNumber: `ORD-${String(on).padStart(4, '0')}`,
        type: 'SERVICE',
        customerId: cust[o.cust],
        customerName: o.cust,
        subtotal,
        vat,
        total: subtotal + vat,
        status: o.status,
        paymentStatus: o.status === 'COMPLETED' ? 'PAID' : 'PENDING',
        staffMemberId: staff[(on - 1) % staff.length],
        createdAt: day(o.days),
      },
    });
    on += 1;
  }

  // ── Platform invoices (billing surface) ────────────────────────────────────
  await db.invoice.createMany({
    data: [
      { companyId, number: 'INV-2026-001', amount: 299, vat: 45, total: 344, status: 'PAID', createdAt: day(33), paidAt: day(33) },
      { companyId, number: 'INV-2026-002', amount: 299, vat: 45, total: 344, status: 'OPEN', createdAt: day(3), paidAt: null },
    ],
  });

  // ── Website config (hero, about, contact, chat widget) ─────────────────────
  await db.websiteConfig.upsert({
    where: { companyId },
    update: {
      heroTitle: 'مجمع ريفاين الطبي',
      heroSubtitle: 'الأسنان · الجلدية · الليزر · التجميل — رعاية طبية وتجميلية متكاملة في عنيزة.',
      aboutTitle: 'عن ريفاين',
      aboutContent:
        'المجمع الطبي الأحدث في عنيزة، يجمع نخبة من الأطباء وأحدث الأجهزة لتقديم خدمات الأسنان والجلدية والليزر والتجميل في أجواء راقية.',
      phone: PHONE,
      whatsapp: PHONE,
      address: 'عنيزة، حي المنار، منطقة القصيم',
      instagram: 'refineksa',
      tiktok: 'refineksa',
      twitter: 'refineksa',
      chatEnabled: true,
      chatAgentId: agent.id,
      chatGreeting: 'أهلاً بك في مجمع ريفاين الطبي 👋 كيف أقدر أساعدك؟ تقدر تستفسر عن الخدمات أو تحجز موعدك.',
      showServices: true,
      showAbout: true,
      showContact: true,
    },
    create: {
      companyId,
      heroTitle: 'مجمع ريفاين الطبي',
      heroSubtitle: 'الأسنان · الجلدية · الليزر · التجميل — رعاية طبية وتجميلية متكاملة في عنيزة.',
      aboutTitle: 'عن ريفاين',
      aboutContent:
        'المجمع الطبي الأحدث في عنيزة، يجمع نخبة من الأطباء وأحدث الأجهزة لتقديم خدمات الأسنان والجلدية والليزر والتجميل في أجواء راقية.',
      phone: PHONE,
      whatsapp: PHONE,
      address: 'عنيزة، حي المنار، منطقة القصيم',
      instagram: 'refineksa',
      tiktok: 'refineksa',
      twitter: 'refineksa',
      chatEnabled: true,
      chatAgentId: agent.id,
      chatGreeting: 'أهلاً بك في مجمع ريفاين الطبي 👋 كيف أقدر أساعدك؟ تقدر تستفسر عن الخدمات أو تحجز موعدك.',
      showServices: true,
      showAbout: true,
      showContact: true,
    },
  });

  console.log(`✓ Refine demo ready — ${svcDefs.length} services across ${clinicDefs.length} clinics.`);
  console.log(`  Site:  /${SLUG}`);
  console.log(`  Login: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Refine seed failed:', err);
    process.exit(1);
  });
