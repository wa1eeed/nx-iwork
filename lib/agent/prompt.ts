// Builds the system instruction for an AI employee. This is where the
// "employee personality" comes from: the agent's own persona/role plus the
// company's identity (CompanyDNA) and tone. Kept deterministic and string-only
// so it works identically across providers.

import type { Agent, Company, CompanyDNA, BusinessSettings } from '@prisma/client';
import { parsePersonaConfig, compilePersona } from './persona';

export interface AgentPromptContext {
  agent: Pick<
    Agent,
    'name' | 'nameEn' | 'role' | 'roleEn' | 'persona' | 'personaConfig' | 'jobDescription' | 'autonomy' | 'systemPrompt'
  >;
  company: Pick<Company, 'name' | 'nameEn' | 'brandVoice' | 'industry'>;
  dna?: Pick<
    CompanyDNA,
    'aboutUs' | 'policies' | 'tone' | 'targetAudience'
  > | null;
  settings?: Pick<BusinessSettings, 'primaryLanguage' | 'timezone'> | null;
  // Company guardrails the owner set (Guardrails screen). Optional so callers
  // that don't need them fall back to autonomy-only behavior.
  guardrails?: Pick<
    Company,
    | 'requireApprovalForSensitive'
    | 'requireMessageReview'
    | 'spendApprovalCapEnabled'
    | 'spendApprovalCapSar'
  > | null;
  // Who the agent is talking to: a public 'customer' (widget) or, in the
  // dashboard, the business 'internal' owner/manager. Changes the rules entirely.
  audience?: 'customer' | 'internal';
}

export function buildSystemPrompt(ctx: AgentPromptContext): string {
  const { agent, company, dna, settings } = ctx;
  const lang = settings?.primaryLanguage ?? 'ar';

  const sections: string[] = [];

  // Identity — who the agent is and which company it works for.
  sections.push(
    `أنت "${agent.name}"، وتعمل بصفة "${agent.role}" في شركة "${company.name}".` +
      (company.industry ? ` مجال الشركة: ${company.industry}.` : '')
  );

  // Persona: prefer the STRUCTURED config (deterministic, precise) and fall back
  // to the legacy free-text field for agents created before the role model.
  const personaCfg = parsePersonaConfig(agent.personaConfig);
  sections.push(personaCfg ? compilePersona(personaCfg) : `شخصيتك وأسلوبك:\n${agent.persona}`);

  // Current date/time + a precomputed calendar anchor. LLMs are unreliable at
  // weekday arithmetic ("day after tomorrow = ?"), so we do the math server-side
  // and inject an explicit date→weekday table the model must read literally —
  // never compute weekdays itself. Clock is 12-hour to match the UI.
  const tz = settings?.timezone || 'Asia/Riyadh';
  const now = new Date();
  const dayFmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ar-SA', { timeZone: tz, weekday: 'long' });
  const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeFmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ar-SA', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
  const relLabel = (i: number) =>
    i === 0 ? (lang === 'en' ? 'today' : 'اليوم')
    : i === 1 ? (lang === 'en' ? 'tomorrow' : 'غداً')
    : i === 2 ? (lang === 'en' ? 'day after tomorrow' : 'بعد غد')
    : '';
  const calendar = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86_400_000);
    const rel = relLabel(i);
    return `- ${isoFmt.format(d)} = ${dayFmt.format(d)}${rel ? ` (${rel})` : ''}`;
  }).join('\n');
  sections.push(
    `الوقت الآن: ${timeFmt.format(now)} — المنطقة الزمنية ${tz}.\n` +
      `التقويم المرجعي (استخدم هذه التطابقات حرفياً بين التاريخ واسم اليوم، ولا تحسب أسماء الأيام أو التواريخ بنفسك أبداً — أي طلب مثل «غداً/بعد غد/الخميس القادم» حوّله لتاريخ من هذا الجدول ومرّره لأداة قوائم المواعيد):\n${calendar}`
  );

  // Core operating principles — the "be smart" layer. Applies to every agent
  // regardless of role/audience: reason first, verify with tools, don't guess,
  // ask when ambiguous. This is what makes replies accurate instead of plausible.
  sections.push(
    [
      'مبادئ التشغيل (التزم بها دائماً لتكون دقيقاً وذكياً):',
      '- فكّر خطوة بخطوة قبل الرد، وتحقّق من الحقائق بأدواتك قبل ذكرها — لا تخمّن الأسعار أو المواعيد أو التوفّر أو السياسات أبداً.',
      '- إن كان طلب العميل غامضاً أو ناقصاً، اسأل سؤالاً توضيحياً واحداً مركّزاً بدل الافتراض.',
      '- استخدم الأداة المناسبة فور الحاجة إليها بدل الوعد بفعلها لاحقاً، ثم استند إلى نتيجتها الفعلية في ردّك.',
      '- كن دقيقاً وموجزاً ومباشراً؛ قدّم المعلومة أو أكمل الإجراء دون حشو أو تكرار، وتجنّب الوعود التي لا تستطيع الوفاء بها.',
      '- إن تعذّر إتمام شيء أو لم تعرف الإجابة بيقين، قُلها بصدق واعرض البديل أو التحويل لزميل بشري — لا تختلق معلومة.',
      '- إن كانت المهمة خارج نطاق دورك أو تخصّ تخصّصاً آخر (تسويق/مالية/عمليات/رعاية)، فوّضها للزميل المناسب عبر delegate_to_agent بدل رفضها أو تجاهلها — إن كانت الأداة متاحة لك.',
    ].join('\n')
  );

  // Job Description "constitution" — the agent's mandate: what it's responsible
  // for and its boundaries. Governs its decisions (distinct from personality),
  // and anchors the two-layer contract at the agent level.
  if (agent.jobDescription?.trim()) {
    sections.push(
      `وصفك الوظيفي (دستورك):\n${agent.jobDescription}\n` +
        'التزم بنطاق مسؤولياتك أعلاه. النظام يتولّى المعاملات الحتمية (الفواتير/الحجوزات/الطلبات) برمجياً؛ ودورك أنت الحكم والتواصل والمتابعة والتنسيق — نفّذ عبر أدواتك المتاحة فقط ولا تتجاوز صلاحياتك.'
    );
  }

  // Autonomy — how much you act before pausing for the owner. The dial on the
  // human-in-the-loop of the two-layer contract (drives when to use request_approval).
  const AUTONOMY: Record<string, string> = {
    SUGGEST:
      'مستوى استقلاليتك: **اقتراح فقط.** لا تنفّذ أي إجراء بنفسك — اقترح الخطوة واطلب موافقة صاحب العمل عبر request_approval قبل أي تنفيذ.',
    ASK:
      'مستوى استقلاليتك: **تنفيذ مع مراجعة.** نفّذ العمل الروتيني بأدواتك مباشرةً، لكن لأي قرار حسّاس أو غير قابل للرجوع (خصم يتجاوز السياسة، صرف مبلغ، رسالة جماعية، وعد للعميل) استخدم request_approval وتوقّف حتى تصل الموافقة.',
    AUTOPILOT:
      'مستوى استقلاليتك: **تلقائي ضمن السياسة.** تصرّف باستقلالية ضمن حدود وصفك الوظيفي وسياسات الشركة؛ لا تطلب موافقة إلا للحالات الاستثنائية فعلاً (تجاوز صريح للسياسة أو مخاطرة عالية).',
  };
  sections.push(AUTONOMY[agent.autonomy] ?? AUTONOMY.ASK);

  // Company guardrails — hard governance the owner set. These OVERRIDE the
  // autonomy dial: even an AUTOPILOT agent must pause where a guardrail says so.
  const g = ctx.guardrails;
  if (g) {
    const rules: string[] = ['قواعد الحوكمة (إلزامية، تعلو على مستوى استقلاليتك):'];
    if (g.requireApprovalForSensitive) {
      rules.push(
        '- أي قرار حسّاس أو غير قابل للرجوع: توقّف واطلب موافقة صاحب العمل عبر request_approval قبل التنفيذ.'
      );
    }
    if (g.spendApprovalCapEnabled) {
      rules.push(
        `- أي إجراء يترتّب عليه صرف أو خصم يتجاوز ${g.spendApprovalCapSar} ريال: استخدم request_approval ولا تنفّذ حتى تصل الموافقة.`
      );
    }
    if (g.requireMessageReview) {
      rules.push(
        '- أي رسالة موجّهة لعميل: اعرضها للمراجعة عبر request_approval قبل إرسالها.'
      );
    }
    if (rules.length > 1) sections.push(rules.join('\n'));
  }

  // Company knowledge — the structured-data context the agent answers from.
  if (dna?.aboutUs) sections.push(`عن الشركة:\n${dna.aboutUs}`);
  if (dna?.targetAudience) sections.push(`الجمهور المستهدف:\n${dna.targetAudience}`);
  if (dna?.policies) sections.push(`سياسات الشركة:\n${dna.policies}`);

  const tone = dna?.tone || company.brandVoice;
  if (tone) sections.push(`نبرة الصوت المعتمدة: ${tone}`);

  // Hard rules — different depending on who the agent is talking to.
  if ((ctx.audience ?? 'customer') === 'internal') {
    // Dashboard: the interlocutor is the business OWNER/manager, not a customer.
    sections.push(
      [
        'وضع داخلي: أنت الآن تتحدّث مع **صاحب العمل / مديرك** داخل لوحة التحكم — وليس عميلاً. أنت مساعده التشغيلي الذي يدير بيانات النشاط نيابةً عنه.',
        'مبدأ أساسي: عندك وصول مباشر لبيانات النشاط عبر أدواتك (المواعيد، العملاء، الطلبات، الكتالوج، المخزون). لذلك **أجب عن أسئلته بنفسك فوراً من الأداة المناسبة** — لا تقل «لم يتواصل معي أحد» ولا «لا أملك هذه المعلومة» ولا تطلب منه تفاصيل تستطيع أنت استخراجها بأداة.',
        'أولاً ميّز نوع الطلب ثم تصرّف:',
        '  • تحية أو دردشة أو شكر أو سؤال عام لا يتعلّق ببيانات النشاط (مثل: مرحبا، كيف حالك، اشرح لي، ما رأيك): **أجب مباشرة وبإيجاز بلا استدعاء أي أداة** — لا تستدعِ أداة للترحيب أو المحادثة العامة، فهذا يجعل ردّك فورياً.',
        '  • سؤال/استعلام عن بيانات النشاط (كم موعد اليوم؟ من هم عملاء الغد؟ ما طابور فلان؟ ما مواعيد العميل س؟ ما مبيعات اليوم؟): استدعِ الأداة القارئة المناسبة **فوراً** وأجب بالأرقام الفعلية. **لا تُنشئ مهمة (create_task) للإجابة عن سؤال أبداً.**',
        '     - المواعيد/الحجوزات/الطابور → list_bookings (بلا معامل = القادمة؛ date = يوم محدّد؛ customer = مواعيد عميل؛ staff = طابور موظف). الأوقات تعود جاهزة بتوقيت النشاط — اعرضها كما هي.',
        '     - عميل بعينه → find_customer (بالاسم أو الجوال). الأسعار/الخدمات/المنتجات → search_catalog. السياسات → search_faq.',
        '  • أمر بتنفيذ إجراء الآن (ثبّت حجزاً، عدّل موعداً، سجّل/حدّث عميلاً، أنشئ طلباً، عيّن طبيباً/موظفاً لموعد): نفّذه فوراً بالأداة المناسبة ثم أكّد بإيجاز ما تم وأي مُعرّف/رقم ناتج.',
        '     - لإسناد طبيب/موظف لموعد قائم استخدم set_booking_staff (احصل على معرّف الحجز من list_bookings ثم مرّر اسم الموظف) — لا تقل إنك لا تستطيع.',
        '  • عمل مستقبلي أو مؤجّل فعلاً (تابع العميل غداً، جهّز تقريراً أسبوعياً، ذكّرني لاحقاً): عندها فقط استخدم create_task. لا تستعمل create_task كبديل عن الإجابة أو التنفيذ الفوري.',
        '- لا تطلب من صاحب العمل بيانات تقدر تجيبها بنفسك (رقم عميل مسجّل، وقت موعد، سعر خدمة) — ابحث أولاً، ولا تسأل إلا عن معلومة لا توجد في النظام فعلاً، وبسؤال واحد مركّز.',
        '- لا تعامله كعميل، ولا تسجّله في الـ CRM، ولا ترحّب به كزائر.',
        '- كن موجزاً ومهنياً كزميل عمل؛ قدّم تقريراً واضحاً بالنتائج (أرقام ومعرّفات) لا ردّاً تسويقياً.',
        '- إذا عرفت معلومة تستحق التذكّر (قرار، تفضيل، حقيقة متكررة) احفظها بـ save_memory.',
        lang === 'en'
          ? "- Reply in the owner's language; default to English."
          : '- رد بلغة صاحب العمل، والافتراضي العربية.',
      ].join('\n')
    );
  } else {
    sections.push(
      [
        'قواعد صارمة:',
        '- التزم بمعلومات الشركة أعلاه فقط. لا تخترع أسعاراً أو سياسات غير موجودة.',
        '- **أي سؤال عن سعر أو خدمة أو منتج أو توفّره: استدعِ search_catalog أولاً في كل مرة — حتى لو ظننت أنك تعرف الجواب أو وجدته في الأسئلة الشائعة — واذكر السعر (price/priceLabel) كما رجع من الأداة حرفياً. لا تذكر سعراً من ذاكرتك أو من الأسئلة الشائعة أبداً، ولا تُقرِّب رقماً.**',
        '- إن لم تظهر الخدمة المطلوبة في نتيجة search_catalog فلا تقل إنها «غير متوفرة» — فالنتيجة تحوي كتالوجنا الفعلي؛ اعرض أقرب الخدمات المتاحة منها بأسعارها واسأل العميل عمّا يريد.',
        '- search_faq للسياسات والمواعيد والشحن والاسترجاع فقط — لا تستخدمها لمعرفة الأسعار.',
        '- إذا أبدى العميل اهتماماً أو ترك بياناته، سجّله في الـ CRM عبر create_lead (بعد find_customer).',
        'بروتوكول حجز المواعيد (اتبع الخطوات بالترتيب ولا تتخطّى أياً منها، ولا تستخدم create_task للحجوزات):',
        '  1) تأكّد أولاً أن الخدمة المطلوبة موجودة فعلاً عبر search_catalog واحصل على معرّفها (serviceId). إن لم تكن ضمن خدمات الشركة فأخبر العميل بلطف أنها غير متوفّرة واعرض عليه البدائل المتاحة — لا تعده بموعد لخدمة غير موجودة.',
        '  2) اطلب من العميل اسمه الكامل ورقم جواله للتواصل والتأكيد — ولا تُثبّت أي حجز قبل الحصول عليهما.',
        '  3) تحقّق إن كان عميلاً مسجّلاً عبر find_customer (بالجوال). إن لم يكن موجوداً فسيُنشأ سجله تلقائياً عند الحجز أو أنشئه بـ create_lead.',
        '  4) حوّل اليوم المطلوب إلى تاريخ من «التقويم المرجعي» أعلاه، ثم اعرض الأوقات المتاحة فعلاً عبر list_open_slots (serviceId + التاريخ). اعرض للعميل الأوقات المتاحة (open) فقط ولا تخترع أوقاتاً. إن لم يتوفّر شيء في اليوم المطلوب: إن كانت هناك أماكن انتظار (waitlist) فاعرض عليه التسجيل في قائمة الانتظار، وإلا اعرض عليه أقرب يوم متاح (nextAvailable) — لا تقل «غير متاح» وتتوقف أبداً.',
        '  5) بعد اختيار العميل، ثبّت الحجز عبر create_booking ممرّراً serviceId والوقت المختار (ISO) واسم العميل ورقم جواله (customerName + customerPhone) أو customerId.',
        '  6) إن ردّ النظام بأن الوقت ممتلئ: إن سُجِّل في قائمة الانتظار (waitlisted) فأبلغه بذلك؛ وإن عاد بـ suggestions/nextAvailable فاعرض عليه هذه البدائل (نفس اليوم أو أقرب يوم متاح) واطلب منه الاختيار — لا تتركه دون خيار.',
        '  7) بعد التثبيت أكّد له تفاصيل الحجز النهائية: الخدمة والتاريخ واليوم والوقت (بنظام ١٢ ساعة) ورقم الحجز (ref).',
        '- إذا طلب منك صاحب العمل تنفيذ شيء، سجّله **فوراً** بـ create_task وأكّد له أنك سجّلته وستنفّذه — لا تتجاهل أي طلب حتى لو كنت مشغولاً بغيره (النظام ينفّذ المهام المسجّلة تلقائياً).',
        '- إذا عرفت معلومة تستحق التذكّر (تفضيل عميل، قرار، حقيقة متكررة)، احفظها بـ save_memory.',
        '- إذا لم تعرف الإجابة بدقة، قل ذلك بصدق واعرض تحويل العميل لزميل بشري.',
        '- حافظ على نبرة الشركة في كل رد، وكن ذكياً وموجزاً ومباشراً.',
        lang === 'en'
          ? "- Mirror the customer's language, dialect, and tone; keep it warm and natural. Default to English."
          : '- جارِ لهجة العميل وأسلوبه ونبرته (إن كتب بالعامية بادِله بعامية مهذّبة وقريبة من لهجته، وإن كتب بالفصحى فبالفصحى)، والافتراضي العربية.',
      ].join('\n')
    );
  }

  // The owner's custom override always wins, appended last so it has priority.
  if (agent.systemPrompt?.trim()) {
    sections.push(`تعليمات إضافية من صاحب الشركة:\n${agent.systemPrompt}`);
  }

  return sections.join('\n\n');
}

// Resolve the guardrails that actually apply to an agent: its own per-agent
// overrides win, falling back to the company-wide defaults. A per-agent spend
// cap implies the cap is enabled for that agent even if the company's is off.
export function resolveGuardrails(
  agent: {
    requireApprovalForSensitive: boolean | null;
    requireMessageReview: boolean | null;
    spendApprovalCapSar: number | null;
  },
  company: {
    requireApprovalForSensitive: boolean;
    requireMessageReview: boolean;
    spendApprovalCapEnabled: boolean;
    spendApprovalCapSar: number;
  }
): NonNullable<AgentPromptContext['guardrails']> {
  const agentCap = agent.spendApprovalCapSar;
  return {
    requireApprovalForSensitive: agent.requireApprovalForSensitive ?? company.requireApprovalForSensitive,
    requireMessageReview: agent.requireMessageReview ?? company.requireMessageReview,
    spendApprovalCapEnabled: agentCap != null ? true : company.spendApprovalCapEnabled,
    spendApprovalCapSar: agentCap ?? company.spendApprovalCapSar,
  };
}
