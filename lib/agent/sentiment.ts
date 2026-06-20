// Complaint / anger detection for inbound customer messages.
//
// Two-stage to keep it cheap: a fast multilingual keyword gate runs on every
// message for free; only when it trips do we confirm with gemini-2.5-flash.
// Used to fire COMPLAINT_RECEIVED + escalate to the owner's Telegram.

import { getProviderForCompany } from '@/lib/ai';
import { isManagedMode, chargeTokens } from '@/lib/billing/tokens';

// Anger / dissatisfaction cues in Arabic + English. Intentionally broad — the
// model confirms before we escalate, so false positives here are cheap.
const ANGER_HINTS = [
  'angry', 'furious', 'terrible', 'worst', 'awful', 'scam', 'refund', 'cancel',
  'unacceptable', 'ridiculous', 'horrible', 'complain', 'complaint', 'sue',
  'never again', 'disgusting', 'rude', 'useless', 'waste',
  'زعلان', 'غاضب', 'سيئ', 'سيئة', 'زفت', 'نصب', 'احتيال', 'استرجاع', 'إلغاء',
  'مقرف', 'فاشل', 'فاشلة', 'مستحيل', 'أسوأ', 'شكوى', 'أشتكي', 'زبالة', 'حرامي',
  'ما ينفع', 'تعبان منكم', 'خايس',
];

export interface ComplaintVerdict {
  isComplaint: boolean;
  anger: number; // 0..1
  summary: string;
}

const NOT_COMPLAINT: ComplaintVerdict = { isComplaint: false, anger: 0, summary: '' };

function heuristicHit(text: string): boolean {
  const lower = text.toLowerCase();
  return ANGER_HINTS.some((h) => lower.includes(h));
}

function parse(text: string): ComplaintVerdict {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return NOT_COMPLAINT;
  try {
    const p = JSON.parse(match[0]) as Partial<ComplaintVerdict> & { anger?: number };
    const anger = typeof p.anger === 'number' ? Math.min(1, Math.max(0, p.anger)) : 0;
    return {
      isComplaint: Boolean(p.isComplaint) && anger >= 0.6,
      anger,
      summary: typeof p.summary === 'string' ? p.summary.slice(0, 280) : '',
    };
  } catch {
    return NOT_COMPLAINT;
  }
}

export async function detectComplaint(companyId: string, message: string): Promise<ComplaintVerdict> {
  // Stage 1 — free keyword gate.
  if (!heuristicHit(message)) return NOT_COMPLAINT;

  // Stage 2 — confirm with the model.
  const result = await getProviderForCompany(companyId);
  if (!result.ok) return NOT_COMPLAINT; // fail-closed: no escalation without AI

  const system =
    'You classify a single customer message for a business. Decide if it is an ' +
    'angry complaint that warrants escalating to a human. Respond with ONLY JSON: ' +
    '{"isComplaint":boolean,"anger":0..1,"summary":"one short sentence describing the issue"}.';

  try {
    const res = await result.provider.complete({
      system,
      messages: [{ role: 'user', content: message }],
      tier: 'HAIKU',
      temperature: 0,
      maxTokens: 150,
      timeoutMs: 10_000,
    });
    if (isManagedMode()) {
      await chargeTokens(companyId, res.usage.inputTokens + res.usage.outputTokens);
    }
    return parse(res.text);
  } catch (err) {
    console.error('detectComplaint failed', err);
    return NOT_COMPLAINT;
  }
}
