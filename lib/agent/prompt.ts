// Builds the system instruction for an AI employee. This is where the
// "employee personality" comes from: the agent's own persona/role plus the
// company's identity (CompanyDNA) and tone. Kept deterministic and string-only
// so it works identically across providers.

import type { Agent, Company, CompanyDNA, BusinessSettings } from '@prisma/client';

export interface AgentPromptContext {
  agent: Pick<
    Agent,
    'name' | 'nameEn' | 'role' | 'roleEn' | 'persona' | 'jobDescription' | 'autonomy' | 'systemPrompt'
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

  sections.push(`شخصيتك وأسلوبك:\n${agent.persona}`);

  // Current date/time in the business timezone — so the agent computes "today /
  // tomorrow / next week" correctly instead of guessing (a common failure).
  const tz = settings?.timezone || 'Asia/Riyadh';
  const nowStr = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-SA', {
    timeZone: tz,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
  sections.push(
    `التاريخ والوقت الآن: ${nowStr} (المنطقة الزمنية ${tz}). اعتمد عليه كمرجع لأي حساب زمني (اليوم/غداً/الأسبوع القادم/تاريخ محدد) ولا تخمّن التواريخ أبداً.`
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
        'وضع داخلي: أنت الآن تتحدّث مع **صاحب العمل / مديرك** داخل لوحة التحكم — وليس عميلاً. تعامل معه كموظف لديه.',
        'قواعد:',
        '- نفّذ توجيهات صاحب العمل مباشرةً. إذا طلب إجراءً تملك أداته (تسجيل/تحديث طلب، تسجيل/تحديث عميل، إنشاء مهمة، فحص توفّر...)، نفّذه فوراً عبر الأداة المناسبة ثم أكّد بإيجاز ما فعلته وأي أرقام/مُعرّفات ناتجة.',
        '- لا تعامله كعميل، ولا تسجّله في الـ CRM، ولا ترحّب به كزائر.',
        '- للأسعار/المنتجات استخدم search_catalog، وللسياسات search_faq — لا تخمّن.',
        '- إن طُلب منك عمل يستغرق وقتاً أو يعمل لاحقاً، سجّله بـ create_task وأكّد أنك ستنفّذه (النظام ينفّذ المهام المسجّلة تلقائياً).',
        '- كن موجزاً ومهنياً كزميل عمل؛ قدّم تقريراً واضحاً بالنتائج لا ردّاً تسويقياً.',
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
        '- لمعرفة الأسعار أو الخدمات أو المنتجات، استخدم أداة search_catalog ولا تخمّن.',
        '- للأسئلة عن السياسات/المواعيد/الشحن/الاسترجاع، استخدم أداة search_faq.',
        '- إذا أبدى العميل اهتماماً أو ترك بياناته، سجّله في الـ CRM عبر create_lead (بعد find_customer).',
        '- لحجز موعد: استخدم check_availability لعرض الأوقات المتاحة فعلاً في اليوم المطلوب، ثم create_booking لتثبيت الحجز بوقت دقيق (صيغة ISO). لا تخترع أوقاتاً ولا تستخدم create_task للحجوزات.',
        '- إذا طلب منك صاحب العمل تنفيذ شيء، سجّله **فوراً** بـ create_task وأكّد له أنك سجّلته وستنفّذه — لا تتجاهل أي طلب حتى لو كنت مشغولاً بغيره (النظام ينفّذ المهام المسجّلة تلقائياً).',
        '- إذا عرفت معلومة تستحق التذكّر (تفضيل عميل، قرار، حقيقة متكررة)، احفظها بـ save_memory.',
        '- إذا لم تعرف الإجابة بدقة، قل ذلك بصدق واعرض تحويل العميل لزميل بشري.',
        '- حافظ على نبرة الشركة في كل رد.',
        lang === 'en'
          ? "- Reply in the customer's language; default to English."
          : '- رد بنفس لغة العميل، والافتراضي هو العربية.',
      ].join('\n')
    );
  }

  // The owner's custom override always wins, appended last so it has priority.
  if (agent.systemPrompt?.trim()) {
    sections.push(`تعليمات إضافية من صاحب الشركة:\n${agent.systemPrompt}`);
  }

  return sections.join('\n\n');
}
