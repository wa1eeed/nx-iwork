// Structured persona — the second layer of the role model. The owner complained
// the free-text persona field is imprecise; this replaces it with a small set of
// explicit knobs that compile DETERMINISTICALLY into the system prompt, so the
// same config always yields the same behavior. The legacy `Agent.persona` text
// stays as a fallback/summary when no structured config exists.

export type PersonaTone =
  | 'warm' | 'confident' | 'empathetic' | 'creative'
  | 'organized' | 'precise' | 'formal' | 'playful';

export type PersonaVerbosity = 'concise' | 'balanced' | 'detailed';

// How the agent picks its language/dialect. `mirror` = match the customer
// (used by customer-facing agents); `business` = the company's default language;
// `formal_ar` / `en` = force a specific register.
export type LanguagePolicy = 'mirror' | 'business' | 'formal_ar' | 'en';

export interface PersonaConfig {
  tone: PersonaTone;
  verbosity: PersonaVerbosity;
  languagePolicy: LanguagePolicy;
  dos: string[];
  donts: string[];
  signaturePhrases: string[];
}

const TONE_AR: Record<PersonaTone, string> = {
  warm: 'ودّي ومرحّب',
  confident: 'واثق ومقنِع دون إلحاح',
  empathetic: 'متعاطف وصبور',
  creative: 'مبدع وحيوي',
  organized: 'منظّم وعملي',
  precise: 'دقيق ورصين',
  formal: 'رسمي ومهذّب',
  playful: 'خفيف الظل ولبق',
};

const VERBOSITY_AR: Record<PersonaVerbosity, string> = {
  concise: 'اجعل ردودك موجزة ومباشرة (جملة أو جملتان غالباً).',
  balanced: 'وازِن بين الإيجاز والتوضيح بحسب حاجة الموقف.',
  detailed: 'قدّم تفصيلاً وافياً منظّماً عند الحاجة، مع الحفاظ على الوضوح.',
};

const LANG_AR: Record<LanguagePolicy, string> = {
  mirror: 'جارِ لغة العميل ولهجته ونبرته (إن كتب بالعامية فبعامية مهذّبة قريبة من لهجته، وإن كتب بالفصحى فبالفصحى)، والافتراضي العربية.',
  business: 'استخدم لغة النشاط الرسمية، والافتراضي العربية الفصحى المبسّطة.',
  formal_ar: 'استخدم العربية الفصحى الرسمية دائماً.',
  en: 'Always reply in clear, professional English.',
};

export const DEFAULT_PERSONA: PersonaConfig = {
  tone: 'warm',
  verbosity: 'balanced',
  languagePolicy: 'mirror',
  dos: [],
  donts: [],
  signaturePhrases: [],
};

// Loose runtime coercion of a stored JSON blob into a PersonaConfig (values may
// be partial/legacy). Returns null when there's nothing usable, so the caller
// can fall back to the free-text persona.
export function parsePersonaConfig(raw: unknown): PersonaConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const has =
    'tone' in r || 'verbosity' in r || 'languagePolicy' in r ||
    'dos' in r || 'donts' in r || 'signaturePhrases' in r;
  if (!has) return null;
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
  return {
    tone: (typeof r.tone === 'string' && r.tone in TONE_AR ? r.tone : 'warm') as PersonaTone,
    verbosity: (typeof r.verbosity === 'string' && r.verbosity in VERBOSITY_AR ? r.verbosity : 'balanced') as PersonaVerbosity,
    languagePolicy: (typeof r.languagePolicy === 'string' && r.languagePolicy in LANG_AR ? r.languagePolicy : 'mirror') as LanguagePolicy,
    dos: strArr(r.dos),
    donts: strArr(r.donts),
    signaturePhrases: strArr(r.signaturePhrases),
  };
}

// Verbosity → response token ceiling. Ties the ONE "verbosity" knob to the
// model's max output length, so a "concise" agent can't ramble and a "detailed"
// one isn't cut off — replacing the old hardcoded 4096 with a governed value.
export function maxTokensForVerbosity(v: PersonaVerbosity): number {
  return v === 'concise' ? 2048 : v === 'detailed' ? 8192 : 4096;
}

// A short, human-readable one-liner for the profile callout + the NOT-NULL
// `Agent.persona` column, derived when the owner didn't type a free-text persona
// (that field is retired from the form — personaConfig drives behavior). Prefers
// the first line of the mandate, falling back to the role.
export function derivePersonaSummary(role: string, jobDescription?: string | null): string {
  const firstLine = (jobDescription ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  return (firstLine || role).slice(0, 180);
}

// Compile a structured persona into a deterministic Arabic prompt block.
export function compilePersona(cfg: PersonaConfig): string {
  const lines: string[] = ['شخصيتك وأسلوبك:'];
  lines.push(`- النبرة: ${TONE_AR[cfg.tone]}.`);
  lines.push(`- ${VERBOSITY_AR[cfg.verbosity]}`);
  lines.push(`- اللغة: ${LANG_AR[cfg.languagePolicy]}`);
  if (cfg.dos.length) lines.push(`- التزم بـ: ${cfg.dos.join('؛ ')}.`);
  if (cfg.donts.length) lines.push(`- تجنّب: ${cfg.donts.join('؛ ')}.`);
  if (cfg.signaturePhrases.length) {
    lines.push(`- عبارات مميّزة لك يمكنك استخدامها بطبيعية: «${cfg.signaturePhrases.join('»، «')}».`);
  }
  return lines.join('\n');
}
