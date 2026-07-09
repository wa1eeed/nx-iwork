import { describe, it, expect } from 'vitest';
import { deptHue } from './dept-accent';

describe('deptHue', () => {
  it('maps known departments to the design-handoff hues', () => {
    expect(deptHue({ name: 'Sales' })).toBe(155);
    expect(deptHue({ name: 'Marketing' })).toBe(40);
    expect(deptHue({ name: 'Support' })).toBe(305);
    expect(deptHue({ name: 'Operations' })).toBe(200);
    expect(deptHue({ name: 'Finance' })).toBe(80);
    expect(deptHue({ name: 'Appointments' })).toBe(250);
  });

  it('matches case-insensitively and by substring, preferring nameEn', () => {
    expect(deptHue({ name: 'قسم المبيعات', nameEn: 'SALES team' })).toBe(155);
    expect(deptHue({ name: 'customer support' })).toBe(305);
  });

  it('is deterministic for unknown names (same id → same hue)', () => {
    const a = deptHue({ name: 'Logistics', id: 'dep_123' });
    const b = deptHue({ name: 'Logistics', id: 'dep_123' });
    expect(a).toBe(b);
    expect(typeof a).toBe('number');
  });

  it('never throws on empty input', () => {
    expect(typeof deptHue({})).toBe('number');
  });
});
