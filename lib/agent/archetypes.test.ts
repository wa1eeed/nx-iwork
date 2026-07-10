import { describe, it, expect } from 'vitest';
import {
  ARCHETYPES,
  getArchetype,
  isCustomerFacing,
  archetypeForTemplate,
} from './archetypes';
import { parsePersonaConfig, compilePersona } from './persona';

describe('archetypes', () => {
  it('exposes the 6 sector-agnostic archetypes', () => {
    expect(ARCHETYPES.map((a) => a.key).sort()).toEqual(
      ['care', 'finance', 'front_desk', 'marketing', 'operations', 'sales'].sort(),
    );
  });

  it('scopes customer-facing vs internal correctly', () => {
    expect(isCustomerFacing('front_desk')).toBe(true);
    expect(isCustomerFacing('sales')).toBe(true);
    expect(isCustomerFacing('care')).toBe(true);
    expect(isCustomerFacing('marketing')).toBe(false);
    expect(isCustomerFacing('operations')).toBe(false);
    expect(isCustomerFacing('finance')).toBe(false);
  });

  it('treats an unknown/legacy archetype as customer-facing (backward compatible)', () => {
    expect(isCustomerFacing(null)).toBe(true);
    expect(isCustomerFacing('something_old')).toBe(true);
    expect(getArchetype('nope')).toBeNull();
  });

  it('maps legacy template keys to archetypes (marketing → internal)', () => {
    expect(archetypeForTemplate('marketing')).toBe('marketing');
    expect(archetypeForTemplate('support')).toBe('care');
    expect(archetypeForTemplate('appointments')).toBe('front_desk');
    expect(archetypeForTemplate('unknown')).toBe('front_desk');
    expect(getArchetype(archetypeForTemplate('marketing'))?.surface).toBe('INTERNAL');
  });

  it('only internal archetypes can produce deliverables via create_output', () => {
    for (const a of ARCHETYPES) {
      if (a.surface === 'INTERNAL') expect(a.permissions).toContain('create_output');
    }
  });
});

describe('structured persona', () => {
  it('returns null when there is nothing usable to parse', () => {
    expect(parsePersonaConfig(null)).toBeNull();
    expect(parsePersonaConfig({})).toBeNull();
    expect(parsePersonaConfig('text')).toBeNull();
  });

  it('coerces a partial config, filling defaults and dropping empties', () => {
    const cfg = parsePersonaConfig({ tone: 'precise', dos: ['x', '', '  '] });
    expect(cfg).not.toBeNull();
    expect(cfg!.tone).toBe('precise');
    expect(cfg!.verbosity).toBe('balanced'); // default
    expect(cfg!.languagePolicy).toBe('mirror'); // default
    expect(cfg!.dos).toEqual(['x']);
  });

  it('compiles to a deterministic Arabic block with the tone + dos/donts', () => {
    const out = compilePersona({
      tone: 'empathetic',
      verbosity: 'concise',
      languagePolicy: 'mirror',
      dos: ['اعتذر بصدق'],
      donts: ['لا تتجاهل الانزعاج'],
      signaturePhrases: [],
    });
    expect(out).toContain('شخصيتك وأسلوبك');
    expect(out).toContain('اعتذر بصدق');
    expect(out).toContain('لا تتجاهل الانزعاج');
  });
});
