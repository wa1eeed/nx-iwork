// Cognitive onboarding — the moment a new agent is hired, seed its long-term
// memory with the business context and FAQ so it can work knowledgeably from
// its very first message. Stored via saveMemory, which embeds (1536-dim) and
// degrades gracefully when embeddings aren't configured. Best-effort: a failure
// here must never fail agent creation.

import { db } from '@/lib/db';
import { saveMemory } from './memory';

export async function cognitiveOnboard(agentId: string, companyId: string): Promise<void> {
  try {
    const [company, faqs] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: { name: true, nameEn: true, industry: true, mainGoal: true, vision: true, brandVoice: true },
      }),
      db.faqItem.findMany({
        where: { companyId, isActive: true },
        orderBy: { sortOrder: 'asc' },
        take: 8,
        select: { question: true, answer: true },
      }),
    ]);
    if (!company) return;

    const context = [
      `Business: ${company.name}${company.nameEn ? ` (${company.nameEn})` : ''}.`,
      company.industry ? `Industry: ${company.industry}.` : '',
      company.mainGoal ? `Main goal: ${company.mainGoal}.` : '',
      company.vision ? `Vision: ${company.vision}.` : '',
      company.brandVoice ? `Brand voice: ${company.brandVoice}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    // One business-context memory (high importance) — embedded once.
    await saveMemory({
      agentId,
      companyId,
      summary: `Company context — ${context}`,
      importance: 9,
      category: 'onboarding',
    });

    // One combined FAQ memory (embedded once) so onboarding stays fast.
    if (faqs.length > 0) {
      const faqBlock = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');
      await saveMemory({
        agentId,
        companyId,
        summary: `Frequently asked questions:\n${faqBlock}`,
        importance: 6,
        category: 'onboarding',
      });
    }
  } catch (err) {
    console.error('cognitiveOnboard failed (best-effort)', err);
  }
}
