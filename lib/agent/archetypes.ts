// Sector-agnostic agent archetypes — the first layer of the 3-layer role model
// (archetype → persona → mandate). An archetype is a CAPABILITY BUNDLE: which
// tools the agent gets, whether it may face customers, what it delivers, its
// default autonomy + KPIs, and a persona starting point. It is deliberately
// generic: ONE "front_desk" archetype fits a clinic's receptionist, a salon's,
// and a workshop's intake desk — the business's own catalog/services make it
// specific, not a hardcoded per-industry role.
//
// The owner picks an archetype at creation; it SEEDS everything, but each field
// stays overridable (permissions toggles, persona editor, autonomy dial).

import type { AutonomyLevel } from '@prisma/client';
import type { PersonaConfig } from './persona';

export type AgentSurface = 'CUSTOMER_FACING' | 'INTERNAL';
export type OutputType = 'MESSAGE' | 'REPORT' | 'PLAN' | 'CONTENT' | 'ANALYSIS' | 'ACTION_LOG';

export interface Archetype {
  key: string;
  /** Display labels (the visible role name defaults from these). */
  label: { ar: string; en: string };
  /** One-line description of the archetype's remit (sector-neutral). */
  summary: { ar: string; en: string };
  /** Hard customer/internal scope — gates the public widget. */
  surface: AgentSurface;
  /** Seed tool allow-list (see lib/agent/tools.ts tool names). */
  permissions: string[];
  /** Deliverable types this archetype produces into the outputs hub. */
  outputTypes: OutputType[];
  /** Default human-in-the-loop dial. */
  autonomy: AutonomyLevel;
  /** Seed KPIs ([{ key, label, target, unit }]). */
  kpis: Array<{ key: string; label: string; target: number; unit: string }>;
  /** Persona starting point (tone/verbosity/etc.) — fully editable after. */
  persona: PersonaConfig;
  /** Lucide icon name + accent, for the picker. */
  icon: string;
  accent: string;
}

// Tool bundles reused across archetypes (keep the lists readable + consistent).
const READS = ['search_catalog', 'search_faq', 'find_customer', 'save_memory'];
const BOOKING = ['check_availability', 'list_open_slots', 'create_booking', 'update_booking'];

export const ARCHETYPES: Archetype[] = [
  {
    key: 'front_desk',
    label: { ar: 'الاستقبال والحجز', en: 'Front Desk & Booking' },
    summary: {
      ar: 'يرحّب بالعملاء، يجيب استفساراتهم، ويحجز/يعدّل مواعيدهم على الجدول.',
      en: 'Greets customers, answers questions, and books or reschedules appointments.',
    },
    surface: 'CUSTOMER_FACING',
    permissions: [...READS, ...BOOKING, 'create_lead'],
    outputTypes: ['MESSAGE', 'ACTION_LOG'],
    autonomy: 'ASK',
    kpis: [
      { key: 'booking_rate', label: 'نسبة الحجز', target: 60, unit: '%' },
      { key: 'no_show_rate', label: 'نسبة عدم الحضور', target: 10, unit: '%' },
      { key: 'response_time', label: 'زمن الرد', target: 3, unit: 'د' },
    ],
    persona: {
      tone: 'warm',
      verbosity: 'concise',
      languagePolicy: 'mirror',
      dos: ['يؤكّد التفاصيل قبل الحجز', 'يقترح أقرب موعد متاح أو قائمة الانتظار'],
      donts: ['لا يعد بموعد لخدمة غير موجودة', 'لا يخترع أسعاراً أو أوقاتاً'],
      signaturePhrases: [],
    },
    icon: 'CalendarCheck',
    accent: 'oklch(0.72 0.13 195)',
  },
  {
    key: 'sales',
    label: { ar: 'المبيعات والنمو', en: 'Sales & Growth' },
    summary: {
      ar: 'يؤهّل العملاء المحتملين، يتابعهم، يغلق الصفقات ويقترح عروضاً أعلى.',
      en: 'Qualifies leads, follows up, closes deals, and upsells.',
    },
    surface: 'CUSTOMER_FACING',
    permissions: ['search_catalog', 'find_customer', 'create_lead', 'update_lead', 'create_order', 'create_task', 'save_memory'],
    outputTypes: ['MESSAGE', 'PLAN', 'REPORT', 'ACTION_LOG'],
    autonomy: 'ASK',
    kpis: [
      { key: 'qualification_rate', label: 'نسبة التأهيل', target: 40, unit: '%' },
      { key: 'conversion_rate', label: 'نسبة التحويل', target: 25, unit: '%' },
      { key: 'response_time', label: 'زمن الرد', target: 3, unit: 'د' },
    ],
    persona: {
      tone: 'confident',
      verbosity: 'balanced',
      languagePolicy: 'mirror',
      dos: ['يربط الفائدة باحتياج العميل', 'يقترح الخطوة التالية بوضوح'],
      donts: ['لا يضغط بإلحاح', 'لا يبالغ في الوعود'],
      signaturePhrases: [],
    },
    icon: 'TrendingUp',
    accent: 'oklch(0.7 0.15 145)',
  },
  {
    key: 'care',
    label: { ar: 'رعاية العملاء', en: 'Customer Care' },
    summary: {
      ar: 'يحلّ المشكلات، يعالج الشكاوى بتعاطف، ويحافظ على العملاء.',
      en: 'Resolves issues, handles complaints with empathy, and retains customers.',
    },
    surface: 'CUSTOMER_FACING',
    permissions: ['search_faq', 'find_customer', 'update_lead', 'create_task', 'update_task_status', 'save_memory', 'request_approval'],
    outputTypes: ['MESSAGE', 'ACTION_LOG'],
    autonomy: 'ASK',
    kpis: [
      { key: 'csat', label: 'رضا العملاء', target: 90, unit: '%' },
      { key: 'resolution_time', label: 'زمن الحل', target: 30, unit: 'د' },
      { key: 'retention_rate', label: 'نسبة الاحتفاظ', target: 85, unit: '%' },
    ],
    persona: {
      tone: 'empathetic',
      verbosity: 'balanced',
      languagePolicy: 'mirror',
      dos: ['يعتذر بصدق عند الخطأ', 'يوضّح الخطوة القادمة والمدة المتوقعة'],
      donts: ['لا يتجاهل انزعاج العميل', 'لا يعد بما لا يملك صلاحيته'],
      signaturePhrases: [],
    },
    icon: 'HeartHandshake',
    accent: 'oklch(0.7 0.14 25)',
  },
  {
    key: 'marketing',
    label: { ar: 'التسويق والمحتوى', en: 'Marketing & Content' },
    summary: {
      ar: 'يخطّط الحملات ويكتب المحتوى والعروض، ويسلّمها كمخرجات للمراجعة.',
      en: 'Plans campaigns and writes content/offers, delivered as reviewable outputs.',
    },
    surface: 'INTERNAL',
    permissions: ['search_catalog', 'save_memory', 'create_output', 'create_task', 'delegate_to_agent'],
    outputTypes: ['CONTENT', 'PLAN', 'REPORT', 'ANALYSIS'],
    autonomy: 'SUGGEST',
    kpis: [
      { key: 'content_output', label: 'مخرجات المحتوى', target: 12, unit: '/شهر' },
      { key: 'engagement_rate', label: 'نسبة التفاعل', target: 5, unit: '%' },
    ],
    persona: {
      tone: 'creative',
      verbosity: 'detailed',
      languagePolicy: 'business',
      dos: ['يقترح زوايا متعددة', 'يربط المحتوى بخدمات النشاط الفعلية'],
      donts: ['لا ينشر شيئاً بنفسه دون موافقة', 'لا يختلق أرقاماً أو ادعاءات'],
      signaturePhrases: [],
    },
    icon: 'Megaphone',
    accent: 'oklch(0.72 0.15 300)',
  },
  {
    key: 'operations',
    label: { ar: 'العمليات والتنسيق', en: 'Operations' },
    summary: {
      ar: 'ينسّق الجدول والطاقم والمهام، ويتابع الإنجاز ويرصد الاختناقات.',
      en: 'Coordinates the schedule, staff, and tasks; tracks completion and bottlenecks.',
    },
    surface: 'INTERNAL',
    permissions: ['find_customer', 'list_bookings', 'update_booking', 'set_booking_staff', 'create_task', 'update_task_status', 'save_memory', 'create_output', 'delegate_to_agent'],
    outputTypes: ['PLAN', 'REPORT', 'ACTION_LOG'],
    autonomy: 'ASK',
    kpis: [
      { key: 'on_time_fulfillment', label: 'الإنجاز في الوقت', target: 95, unit: '%' },
      { key: 'utilization', label: 'استغلال الجدول', target: 75, unit: '%' },
    ],
    persona: {
      tone: 'organized',
      verbosity: 'concise',
      languagePolicy: 'business',
      dos: ['يرتّب حسب الأولوية والوقت', 'يبرز ما يحتاج قراراً'],
      donts: ['لا يعيد جدولة موعد دون تنبيه', 'لا يترك مهمة بلا مالك'],
      signaturePhrases: [],
    },
    icon: 'ClipboardList',
    accent: 'oklch(0.7 0.12 240)',
  },
  {
    key: 'finance',
    label: { ar: 'المالية والمستشار', en: 'Finance & Advisor' },
    summary: {
      ar: 'يتابع الفواتير والتحصيل، ويقدّم تقارير وتحليلات مالية وتوصيات.',
      en: 'Tracks invoicing and collections; delivers financial reports, analysis, and advice.',
    },
    surface: 'INTERNAL',
    permissions: ['find_customer', 'create_order', 'list_bookings', 'save_memory', 'create_output', 'request_approval', 'delegate_to_agent'],
    outputTypes: ['REPORT', 'ANALYSIS', 'PLAN'],
    autonomy: 'SUGGEST',
    kpis: [
      { key: 'invoice_accuracy', label: 'دقة الفوترة', target: 99, unit: '%' },
      { key: 'days_to_collect', label: 'أيام التحصيل', target: 14, unit: 'يوم' },
    ],
    persona: {
      tone: 'precise',
      verbosity: 'balanced',
      languagePolicy: 'business',
      dos: ['يستند للأرقام الفعلية', 'يوضّح الافتراضات خلف أي توصية'],
      donts: ['لا يقدّم نصيحة استثمارية شخصية', 'لا ينفّذ صرفاً دون موافقة'],
      signaturePhrases: [],
    },
    icon: 'Calculator',
    accent: 'oklch(0.7 0.12 90)',
  },
];

const BY_KEY = new Map(ARCHETYPES.map((a) => [a.key, a]));

export function getArchetype(key: string | null | undefined): Archetype | null {
  return key ? BY_KEY.get(key) ?? null : null;
}

export const ARCHETYPE_KEYS = ARCHETYPES.map((a) => a.key);

// Map a legacy template key → a role-model archetype, so template-based hires
// get the right customer/internal scope + capability bundle. Unknown → front_desk.
const TEMPLATE_ARCHETYPE: Record<string, string> = {
  sales: 'sales',
  support: 'care',
  marketing: 'marketing',
  finance: 'finance',
  operations: 'operations',
  appointments: 'front_desk',
  reception: 'front_desk',
  booking: 'front_desk',
};

export function archetypeForTemplate(templateType: string): string {
  return TEMPLATE_ARCHETYPE[templateType] ?? 'front_desk';
}

// Is this archetype allowed to talk to end customers (i.e. serve the widget)?
export function isCustomerFacing(key: string | null | undefined): boolean {
  const a = getArchetype(key);
  // Unknown/legacy archetype → treat as customer-facing (backward compatible:
  // agents predating this model were the customer-service agent).
  return a ? a.surface === 'CUSTOMER_FACING' : true;
}
