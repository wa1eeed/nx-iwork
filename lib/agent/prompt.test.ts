import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './prompt';

const baseAgent = {
  name: 'Faisal',
  nameEn: 'Faisal',
  role: 'Account Manager',
  roleEn: 'Account Manager',
  persona: 'Relationship-first.',
  jobDescription: 'Own the sales pipeline.',
  autonomy: 'ASK' as const,
  systemPrompt: null,
};

const baseCompany = { name: 'Zahra Home', nameEn: 'Zahra Home', brandVoice: null, industry: null };

describe('buildSystemPrompt — guardrails', () => {
  it('injects the spend-cap rule with the configured amount', () => {
    const p = buildSystemPrompt({
      agent: baseAgent,
      company: baseCompany,
      guardrails: {
        requireApprovalForSensitive: true,
        requireMessageReview: false,
        spendApprovalCapEnabled: true,
        spendApprovalCapSar: 500,
      },
      audience: 'internal',
    });
    expect(p).toContain('قواعد الحوكمة');
    expect(p).toContain('500');
    expect(p).toContain('request_approval');
  });

  it('omits the guardrails section entirely when none are active', () => {
    const p = buildSystemPrompt({
      agent: baseAgent,
      company: baseCompany,
      guardrails: {
        requireApprovalForSensitive: false,
        requireMessageReview: false,
        spendApprovalCapEnabled: false,
        spendApprovalCapSar: 500,
      },
      audience: 'internal',
    });
    expect(p).not.toContain('قواعد الحوكمة');
  });

  it('omits the guardrails section when the field is absent', () => {
    const p = buildSystemPrompt({ agent: baseAgent, company: baseCompany, audience: 'internal' });
    expect(p).not.toContain('قواعد الحوكمة');
  });
});

describe('buildSystemPrompt — autonomy dial', () => {
  it('reflects AUTOPILOT autonomy', () => {
    const p = buildSystemPrompt({
      agent: { ...baseAgent, autonomy: 'AUTOPILOT' as const },
      company: baseCompany,
    });
    expect(p).toContain('تلقائي');
  });

  it('reflects SUGGEST autonomy (propose only)', () => {
    const p = buildSystemPrompt({
      agent: { ...baseAgent, autonomy: 'SUGGEST' as const },
      company: baseCompany,
    });
    expect(p).toContain('اقتراح');
  });
});
