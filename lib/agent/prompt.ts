// Builds the system instruction for an AI employee. This is where the
// "employee personality" comes from: the agent's own persona/role plus the
// company's identity (CompanyDNA) and tone. Kept deterministic and string-only
// so it works identically across providers.

import type { Agent, Company, CompanyDNA, BusinessSettings } from '@prisma/client';

export interface AgentPromptContext {
  agent: Pick<
    Agent,
    'name' | 'nameEn' | 'role' | 'roleEn' | 'persona' | 'systemPrompt'
  >;
  company: Pick<Company, 'name' | 'nameEn' | 'brandVoice' | 'industry'>;
  dna?: Pick<
    CompanyDNA,
    'aboutUs' | 'policies' | 'tone' | 'targetAudience'
  > | null;
  settings?: Pick<BusinessSettings, 'primaryLanguage'> | null;
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

  // Company knowledge — the structured-data context the agent answers from.
  if (dna?.aboutUs) sections.push(`عن الشركة:\n${dna.aboutUs}`);
  if (dna?.targetAudience) sections.push(`الجمهور المستهدف:\n${dna.targetAudience}`);
  if (dna?.policies) sections.push(`سياسات الشركة:\n${dna.policies}`);

  const tone = dna?.tone || company.brandVoice;
  if (tone) sections.push(`نبرة الصوت المعتمدة: ${tone}`);

  // Hard rules that keep the employee safe and on-brand.
  sections.push(
    [
      'قواعد صارمة:',
      '- التزم بمعلومات الشركة أعلاه فقط. لا تخترع أسعاراً أو سياسات غير موجودة.',
      '- لمعرفة الأسعار أو الخدمات أو المنتجات، استخدم أداة search_catalog ولا تخمّن.',
      '- إذا أبدى العميل اهتماماً أو ترك بياناته، سجّله في الـ CRM عبر create_lead (بعد find_customer).',
      '- لحجز موعد أو إنشاء مهمة، استخدم create_task.',
      '- إذا عرفت معلومة تستحق التذكّر (تفضيل عميل، قرار، حقيقة متكررة)، احفظها بـ save_memory.',
      '- إذا لم تعرف الإجابة بدقة، قل ذلك بصدق واعرض تحويل العميل لزميل بشري.',
      '- حافظ على نبرة الشركة في كل رد.',
      lang === 'en'
        ? '- Reply in the customer\'s language; default to English.'
        : '- رد بنفس لغة العميل، والافتراضي هو العربية.',
    ].join('\n')
  );

  // The owner's custom override always wins, appended last so it has priority.
  if (agent.systemPrompt?.trim()) {
    sections.push(`تعليمات إضافية من صاحب الشركة:\n${agent.systemPrompt}`);
  }

  return sections.join('\n\n');
}
