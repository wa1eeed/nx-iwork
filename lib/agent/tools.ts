// The tools an AI employee can call. This is the heart of "doing" instead of
// just "chatting": reading the structured catalog (cheap, exact — no PDF
// scanning), capturing leads into the CRM, and booking tasks/appointments.
//
// Every executor is scoped by companyId, so an agent can only ever touch its
// own company's data. Each returns a short JSON string that goes back to the
// model as the tool result.

import { z } from 'zod';
import { Prisma, type BookingStatus, type AgentOutputType, type AgentOutputStatus } from '@prisma/client';
import { db } from '@/lib/db';
import type { AiTool } from '@/lib/ai';
import { nextRef } from '@/lib/refs';
import { createBooking, BookingError, generateDaySlots } from '@/lib/booking/engine';
import { saveMemory } from './memory';
import { dispatchEvent } from './events';

export interface ToolContext {
  companyId: string;
  agentId: string;
}

// Which modules a company has enabled — controls which tools the agent receives.
export interface CompanyModules {
  hasEcommerce: boolean;
  hasServices: boolean;
  hasBookings: boolean;
}

// Sales/catalog tools need e-commerce or services; booking tools need bookings.
const SALES_TOOLS = new Set(['search_catalog', 'create_order']);
const BOOKING_TOOLS = new Set(['check_availability', 'list_open_slots', 'list_bookings', 'create_booking', 'update_booking', 'set_booking_staff']);

// Dynamic tools: only hand the model the tools for the modules this company has
// enabled (cheaper context + the agent never offers what the business can't do).
export function getToolsForCompany(m: CompanyModules): AiTool[] {
  return AGENT_TOOLS.filter((t) => {
    if (SALES_TOOLS.has(t.name)) return m.hasEcommerce || m.hasServices;
    if (BOOKING_TOOLS.has(t.name)) return m.hasBookings;
    return true; // core (CRM, FAQ, tasks + status, memory) always available
  });
}

// Some tools are natural companions of a granted capability. If an agent may
// book or check availability it must also see the open slots, so `list_open_slots`
// rides along with any booking grant. This upgrades agents whose stored allow-lists
// predate that tool (seeded from templates that never listed it) WITHOUT a data
// migration, and it's safe to expose publicly: open slots carry no customer PII.
// NOTE: `list_bookings` (returns customer names + phones) and `set_booking_staff`
// (an owner action) are deliberately NOT companions — they're internal-only and
// granted explicitly by the dashboard chat path, never to the public widget.
const TOOL_COMPANIONS: Record<string, string[]> = {
  check_availability: ['list_open_slots'],
  create_booking: ['list_open_slots'],
  update_booking: ['list_open_slots'],
};

// Per-agent function-calling permissions. An agent receives a tool only if it is
// BOTH module-enabled AND in the agent's (companion-expanded) allow-list. An
// empty allow-list means "all module tools" (backward compatible for agents
// created before permissions existed). This is the hard gate: the model can
// never call a tool it wasn't handed, so a tool outside its permissions is
// unreachable.
export function getToolsForAgent(m: CompanyModules, permissions: string[]): AiTool[] {
  const base = getToolsForCompany(m);
  if (!permissions || permissions.length === 0) return base;
  const allowed = new Set(permissions);
  for (const p of permissions) {
    for (const c of TOOL_COMPANIONS[p] ?? []) allowed.add(c);
  }
  return base.filter((t) => allowed.has(t.name));
}

// ---- Tool catalogue (schemas advertised to the model) ----------------------

export const AGENT_TOOLS: AiTool[] = [
  {
    name: 'search_catalog',
    description:
      'ابحث في خدمات ومنتجات الشركة للحصول على الأسعار والتفاصيل والتوفر. استخدمها كلما سأل العميل عن سعر أو خدمة أو منتج بدل التخمين.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'كلمة البحث (اسم الخدمة/المنتج أو جزء منه). اتركها فارغة لعرض الكل.',
        },
        kind: {
          type: 'string',
          enum: ['service', 'product', 'all'],
          description: 'نوع ما تبحث عنه. الافتراضي all.',
        },
      },
    },
  },
  {
    name: 'check_availability',
    description:
      'تحقّق من المواعيد المحجوزة في يوم/فترة قبل تأكيد حجز جديد (موديول الحجوزات).',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'بداية الفترة ISO 8601' },
        to: { type: 'string', description: 'نهاية الفترة ISO 8601' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'list_open_slots',
    description:
      'اعرض المواعيد المتاحة فعلاً لخدمة قابلة للحجز في يوم محدّد (يحسبها النظام من توفّر الخدمة وسعتها والحجوزات القائمة). استخدمها قبل create_booking لعرض الأوقات على العميل، وعند امتلاء وقتٍ لاقتراح بدائل. إن لم يتوفّر شيء في اليوم المطلوب يعيد أقرب يوم متاح.',
    parameters: {
      type: 'object',
      properties: {
        serviceId: { type: 'string', description: 'معرّف الخدمة (من search_catalog)' },
        date: { type: 'string', description: 'اليوم المطلوب YYYY-MM-DD (بتوقيت النشاط)' },
      },
      required: ['serviceId', 'date'],
    },
  },
  {
    name: 'list_bookings',
    description:
      'اعرض الحجوزات/المواعيد القائمة في النظام للإجابة مباشرةً عن أسئلة مثل «المواعيد القادمة»، «حجوزات اليوم/الغد»، «مواعيد عميل معيّن»، «طابور مواعيد موظف». لا تطلب من المستخدم نطاقاً زمنياً ولا تُنشئ مهمة لهذا — استعمل هذه الأداة وأجب فوراً. الأوقات تُعاد جاهزة بتوقيت النشاط (نظام ١٢ ساعة). بلا أي معامل = المواعيد القادمة من الآن.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'يوم محدّد YYYY-MM-DD (بتوقيت النشاط) — مثلاً حجوزات اليوم أو الغد' },
        from: { type: 'string', description: 'بداية نطاق YYYY-MM-DD (اختياري)' },
        to: { type: 'string', description: 'نهاية نطاق YYYY-MM-DD (اختياري)' },
        customer: { type: 'string', description: 'اسم العميل أو رقم جواله — لعرض مواعيد عميل معيّن' },
        staff: { type: 'string', description: 'اسم الموظف — لعرض طابور مواعيده' },
        status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'WAITLIST', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], description: 'تصفية بالحالة (اختياري)' },
      },
    },
  },
  {
    name: 'set_booking_staff',
    description:
      'خصّص موظفاً/مقدّم خدمة لحجز قائم (يُحتسب في العمولات). مرّر معرّف الحجز bookingId (من list_bookings) واسم الموظف staffName. استخدمها عندما يطلب صاحب العمل تعيين طبيب/موظف لموعد.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'معرّف الحجز من list_bookings' },
        staffName: { type: 'string', description: 'اسم الموظف كما هو مسجّل في الطاقم' },
      },
      required: ['bookingId', 'staffName'],
    },
  },
  {
    name: 'create_booking',
    description:
      'ثبّت حجز موعد لعميل (موديول الحجوزات). قبل استدعائها: (1) احصل على معرّف الخدمة serviceId من search_catalog، (2) اطلب اسم العميل ورقم جواله ومرّرهما (customerName + customerPhone) أو معرّف عميل موجود customerId — لا يُقبل حجز بلا هوية عميل، (3) اعرض الأوقات المتاحة عبر list_open_slots واختر وقتاً منها. النظام يفرض السعة ويتحقق من التعارض تلقائياً، ويقترح بدائل إن كان الوقت ممتلئاً.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'وصف الحجز (مثل: موعد تنظيف أسنان)' },
        startAt: { type: 'string', description: 'وقت البداية ISO 8601 (من أوقات list_open_slots)' },
        endAt: { type: 'string', description: 'وقت النهاية ISO 8601 (اختياري — يحسبه النظام من مدة الخدمة)' },
        serviceId: { type: 'string', description: 'معرّف الخدمة القابلة للحجز (مطلوب لفرض السعة والتحقق من التوفّر)' },
        customerId: { type: 'string', description: 'معرّف العميل من الـ CRM إن كان مسجّلاً' },
        customerName: { type: 'string', description: 'اسم العميل — مطلوب إن لم يوجد customerId (يُنشأ سجل تلقائياً)' },
        customerPhone: { type: 'string', description: 'رقم جوال العميل للتواصل والتأكيد' },
        notes: { type: 'string' },
      },
      required: ['title', 'startAt'],
    },
  },
  {
    name: 'search_faq',
    description:
      'ابحث في الأسئلة الشائعة وسياسات الشركة للإجابة بدقة (مواعيد العمل، الشحن، الاسترجاع...). استخدمها قبل التخمين.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'كلمة البحث في الأسئلة/السياسات. فارغة = عرض الكل.' },
      },
    },
  },
  {
    name: 'find_customer',
    description: 'ابحث عن عميل موجود في الـ CRM بالجوال أو الاسم قبل إنشاء سجل جديد.',
    parameters: {
      type: 'object',
      properties: {
        phone: { type: 'string', description: 'رقم جوال العميل' },
        name: { type: 'string', description: 'اسم العميل أو جزء منه' },
      },
    },
  },
  {
    name: 'create_lead',
    description:
      'أنشئ سجل عميل جديد في الـ CRM عندما يبدي شخص اهتماماً أو يترك بياناته. تحقّق أولاً عبر find_customer.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'اسم العميل' },
        phone: { type: 'string' },
        email: { type: 'string' },
        status: {
          type: 'string',
          enum: ['NEW', 'INTERESTED', 'NEGOTIATING', 'DEFERRED', 'WON', 'LOST'],
          description: 'حالة العميل. الافتراضي NEW.',
        },
        notes: { type: 'string', description: 'ملاحظة موجزة عن طلب العميل' },
        customFields: {
          type: 'object',
          description:
            'حقول خاصة بالنشاط (مثلاً الميزانية، الحي المفضل، عدد الأشخاص). كائن مفتاح/قيمة.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_lead',
    description: 'حدّث بيانات عميل موجود في الـ CRM (الاسم، الجوال، الإيميل، الحالة، الملاحظات).',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'معرّف العميل من find_customer' },
        name: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        status: { type: 'string', enum: ['NEW', 'INTERESTED', 'NEGOTIATING', 'DEFERRED', 'WON', 'LOST'] },
        notes: { type: 'string' },
      },
      required: ['customerId'],
    },
  },
  {
    name: 'update_task_status',
    description: 'حدّث حالة مهمة (مثلاً علّمها منجزة أو ملغاة).',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        status: { type: 'string', enum: ['WORKING', 'DONE', 'CANCELLED', 'BLOCKED'] },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'update_booking',
    description: 'عدّل حجزاً: أعد جدولته (startAt/endAt) أو غيّر حالته (مثل CANCELLED).',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string' },
        startAt: { type: 'string', description: 'ISO 8601' },
        endAt: { type: 'string', description: 'ISO 8601' },
        status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'create_order',
    description: 'سجّل طلباً جديداً لعميل في النظام (وكيل المبيعات). يحفظه في الطلبات ويطلق متابعة تلقائية.',
    parameters: {
      type: 'object',
      properties: {
        customerName: { type: 'string' },
        customerId: { type: 'string', description: 'اربطه بعميل CRM إن وُجد' },
        total: { type: 'number', description: 'الإجمالي قبل الخصم' },
        type: { type: 'string', enum: ['SERVICE', 'PRODUCT'] },
        notes: { type: 'string' },
        couponCode: { type: 'string', description: 'كود خصم اختياري يقدّمه العميل — يُطبَّق إن كان صالحاً' },
      },
      required: ['customerName', 'total'],
    },
  },
  {
    name: 'create_task',
    description:
      'أنشئ مهمة أو موعداً في جدول الشركة: مهمة لموظف (AGENT_TASK)، موعد عميل (APPOINTMENT)، أو تذكير (REMINDER).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        kind: {
          type: 'string',
          enum: ['AGENT_TASK', 'APPOINTMENT', 'REMINDER'],
          description: 'نوع البند. الافتراضي AGENT_TASK.',
        },
        customerId: { type: 'string', description: 'اربطها بعميل من الـ CRM إن وُجد' },
        dueAt: { type: 'string', description: 'موعد الاستحقاق ISO 8601 (مثلاً 2026-07-01T10:00:00Z)' },
        startAt: { type: 'string', description: 'بداية الموعد ISO 8601 (للمواعيد)' },
        endAt: { type: 'string', description: 'نهاية الموعد ISO 8601 (للمواعيد)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'save_memory',
    description:
      'احفظ حقيقة مهمة لتتذكّرها مستقبلاً (تفضيل عميل، قرار، معلومة متكررة، شيء تعلّمته). استخدمها عند معرفة شيء يستحق التذكّر.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'الحقيقة باختصار وبصياغة قابلة للاسترجاع' },
        importance: { type: 'number', description: 'الأهمية من 1 إلى 10' },
        category: {
          type: 'string',
          enum: ['customer', 'product', 'decision', 'learning', 'other'],
        },
      },
      required: ['summary'],
    },
  },
  {
    name: 'request_approval',
    description:
      'اطلب موافقة صاحب العمل قبل تنفيذ قرار حسّاس (خصم يتجاوز السياسة، صرف مبلغ، رسالة تسويقية جماعية، أي إجراء لا رجعة فيه). لا تنفّذ القرار الحسّاس دون موافقة — استخدم هذه الأداة ثم توقّف.',
    parameters: {
      type: 'object',
      properties: {
        decision: { type: 'string', description: 'القرار المطلوب الموافقة عليه، بإيجاز واضح' },
        context: { type: 'string', description: 'سياق مختصر يساعد صاحب العمل على القرار (اختياري)' },
      },
      required: ['decision'],
    },
  },
  {
    name: 'create_output',
    description:
      'سلّم مخرجاً جاهزاً لصاحب العمل (تقرير، خطة، محتوى تسويقي، تحليل، أو مسودة رسالة) ليظهر في «مساحة عمل الوكلاء». استخدمها عندما تُنتج عملاً ملموساً بدل الاكتفاء بالرد في المحادثة — خصوصاً للأدوار الخلفية (تسويق/مالية/عمليات). اكتب المحتوى كاملاً وجاهزاً في body بصيغة Markdown.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['MESSAGE', 'REPORT', 'PLAN', 'CONTENT', 'ANALYSIS', 'ACTION_LOG'],
          description: 'نوع المخرج',
        },
        title: { type: 'string', description: 'عنوان موجز واضح للمخرج' },
        body: { type: 'string', description: 'المحتوى الكامل الجاهز (Markdown)' },
        status: {
          type: 'string',
          enum: ['DRAFT', 'READY'],
          description: 'DRAFT إن كان مسودة أولية، وإلا READY للمراجعة. الافتراضي READY.',
        },
        customerName: { type: 'string', description: 'اسم العميل المرتبط بالمخرج إن وُجد (اختياري)' },
      },
      required: ['type', 'title', 'body'],
    },
  },
  {
    name: 'delegate_to_agent',
    description:
      'فوّض مهمة لزميل وكيل آخر عندما تكون خارج نطاق دورك أو تخصّ تخصّصاً آخر (مثلاً: تحويل طلب محتوى للتسويق، أو متابعة تحصيل للمالية، أو تصعيد شكوى لرعاية العملاء). مرّر اسم الزميل أو دوره (colleague) ووصف المهمة (task). ستُسند إليه وينفّذها تلقائياً. لا تفوّض ما تستطيع إنجازه بنفسك بأدواتك.',
    parameters: {
      type: 'object',
      properties: {
        colleague: { type: 'string', description: 'اسم الوكيل الزميل أو دوره (مثل: التسويق، المالية)' },
        task: { type: 'string', description: 'وصف المهمة المطلوبة بوضوح' },
        note: { type: 'string', description: 'سياق إضافي يساعد الزميل (اختياري)' },
        afterTaskId: { type: 'string', description: 'لتسلسل العمل: نفّذ هذه فقط بعد انتهاء مهمة سابقة (مرّر taskId الذي أعادته أداة تفويض سابقة)' },
      },
      required: ['colleague', 'task'],
    },
  },
];

// ---- Executors -------------------------------------------------------------

const searchCatalogArgs = z.object({
  query: z.string().trim().optional(),
  kind: z.enum(['service', 'product', 'all']).optional(),
});

const searchFaqArgs = z.object({
  query: z.string().trim().optional(),
});

const checkAvailabilityArgs = z.object({
  from: z.string().trim(),
  to: z.string().trim(),
});

const listOpenSlotsArgs = z.object({
  serviceId: z.string().trim().min(1),
  date: z.string().trim().min(1),
});

const listBookingsArgs = z.object({
  date: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  customer: z.string().trim().optional(),
  staff: z.string().trim().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'WAITLIST', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
});

const setBookingStaffArgs = z.object({
  bookingId: z.string().trim().min(1),
  staffName: z.string().trim().min(1),
});

const createBookingArgs = z.object({
  title: z.string().trim().min(1).max(300),
  startAt: z.string().trim(),
  endAt: z.string().trim().optional(),
  serviceId: z.string().trim().optional(), // when set, the engine enforces slot capacity
  customerId: z.string().trim().optional(),
  customerName: z.string().trim().max(200).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const requestApprovalArgs = z.object({
  decision: z.string().trim().min(1).max(500),
  context: z.string().trim().max(2000).optional(),
});

const findCustomerArgs = z.object({
  phone: z.string().trim().optional(),
  name: z.string().trim().optional(),
});

const createLeadArgs = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
  status: z.enum(['NEW', 'INTERESTED', 'NEGOTIATING', 'DEFERRED', 'WON', 'LOST']).optional(),
  notes: z.string().trim().max(2000).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const updateLeadArgs = z.object({
  customerId: z.string().trim().min(1),
  name: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
  status: z.enum(['NEW', 'INTERESTED', 'NEGOTIATING', 'DEFERRED', 'WON', 'LOST']).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const updateTaskStatusArgs = z.object({
  taskId: z.string().trim().min(1),
  status: z.enum(['WORKING', 'DONE', 'CANCELLED', 'BLOCKED']),
});

const updateBookingArgs = z.object({
  bookingId: z.string().trim().min(1),
  startAt: z.string().trim().optional(),
  endAt: z.string().trim().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']).optional(),
});

const createOrderArgs = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerId: z.string().trim().optional(),
  total: z.coerce.number().nonnegative().max(99_999_999),
  type: z.enum(['SERVICE', 'PRODUCT']).optional(),
  notes: z.string().trim().max(2000).optional(),
  couponCode: z.string().trim().max(40).optional(),
});

const createOutputArgs = z.object({
  type: z.enum(['MESSAGE', 'REPORT', 'PLAN', 'CONTENT', 'ANALYSIS', 'ACTION_LOG']),
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  status: z.enum(['DRAFT', 'READY']).optional(),
  customerName: z.string().trim().max(200).optional(),
});

const delegateToAgentArgs = z.object({
  colleague: z.string().trim().min(1).max(120), // target agent's name or role
  task: z.string().trim().min(1).max(2000),
  note: z.string().trim().max(2000).optional(),
  // Optional: run this only AFTER an earlier task finishes (a taskId from a
  // previous delegate_to_agent call) — builds a sequenced multi-agent chain.
  afterTaskId: z.string().trim().optional(),
});

const createTaskArgs = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(4000).optional(),
  kind: z.enum(['AGENT_TASK', 'APPOINTMENT', 'REMINDER']).optional(),
  customerId: z.string().trim().optional(),
  dueAt: z.string().trim().optional(),
  startAt: z.string().trim().optional(),
  endAt: z.string().trim().optional(),
});

const saveMemoryArgs = z.object({
  summary: z.string().trim().min(1).max(2000),
  importance: z.coerce.number().int().min(1).max(10).optional(),
  category: z.enum(['customer', 'product', 'decision', 'learning', 'other']).optional(),
});

function ok(data: unknown): string {
  return JSON.stringify({ ok: true, data });
}
function fail(message: string): string {
  return JSON.stringify({ ok: false, error: message });
}

// Parse an ISO date defensively; returns null on bad input so the model gets a
// clear error instead of a 500.
function parseDate(value?: string): Date | null | undefined {
  if (value === undefined) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// A business-local YYYY-MM-DD for an instant, in the company timezone.
function localDateISO(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

async function companyTimezone(companyId: string): Promise<string> {
  const s = await db.businessSettings.findUnique({
    where: { companyId }, select: { timezone: true },
  });
  return s?.timezone || 'Asia/Riyadh';
}

// Concrete open slots for a service starting at (or after) a given instant, so
// the agent can offer real alternatives when a requested time is full. Scans up
// to `days` calendar days forward and returns the first handful of open slots.
async function suggestAlternatives(
  companyId: string,
  serviceId: string,
  from: Date,
  tz: string,
  days = 7,
  limit = 6,
): Promise<{ date: string; time: string; startAt: string }[]> {
  const out: { date: string; time: string; startAt: string }[] = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const dateISO = localDateISO(new Date(from.getTime() + i * DAY_MS), tz);
    const slots = await generateDaySlots(companyId, serviceId, dateISO);
    for (const s of slots) {
      if (s.available) {
        out.push({ date: dateISO, time: s.label, startAt: s.startAt });
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

// Wall-clock (calendar date + HH:MM) in an IANA zone → the exact UTC instant.
// Mirrors the booking engine's zonedToUtc so day boundaries line up with slots.
function zonedToUtc(y: number, mo: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(guess));
  const val = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let h = val('hour');
  if (h === 24) h = 0;
  const seenAsUtc = Date.UTC(val('year'), val('month') - 1, val('day'), h, val('minute'));
  return new Date(guess - (seenAsUtc - guess));
}

// UTC [from, to) window covering one business-local calendar day (YYYY-MM-DD),
// so "bookings on that day" reads correctly regardless of server timezone.
function localDayRange(dateISO: string, tz: string): { from: Date; to: Date } {
  const [y, mo, d] = dateISO.split('-').map(Number);
  const from = zonedToUtc(y, mo, d, 0, 0, tz);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

// Pre-format an instant in the business timezone so the model never does date
// math: a readable Arabic date + a 12-hour time (Latin digits, ص/م meridiem).
// Returning these ready-made is what keeps agent-quoted times correct.
function fmtWhen(d: Date, tz: string): { date: string; time: string; iso: string } {
  const date = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
  return { date, time, iso: d.toISOString() };
}

export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  try {
    switch (name) {
      case 'search_catalog': {
        const args = searchCatalogArgs.parse(rawArgs);
        const kind = args.kind ?? 'all';
        const contains = args.query
          ? { contains: args.query, mode: Prisma.QueryMode.insensitive }
          : undefined;

        const [services, products] = await Promise.all([
          kind === 'product'
            ? []
            : db.service.findMany({
                where: {
                  companyId: ctx.companyId,
                  isActive: true,
                  ...(contains ? { title: contains } : {}),
                },
                take: 10,
                select: {
                  id: true,
                  title: true,
                  description: true,
                  price: true,
                  priceLabel: true,
                  customFields: true,
                },
              }),
          kind === 'service'
            ? []
            : db.product.findMany({
                where: {
                  companyId: ctx.companyId,
                  isActive: true,
                  ...(contains ? { title: contains } : {}),
                },
                take: 10,
                select: {
                  id: true,
                  title: true,
                  description: true,
                  price: true,
                  stock: true,
                  customFields: true,
                },
              }),
        ]);

        return ok({
          services: services.map((s) => ({
            ...s,
            price: s.price?.toString() ?? null,
          })),
          products: products.map((p) => ({
            ...p,
            price: p.price.toString(),
            available: p.stock !== 0,
          })),
        });
      }

      case 'list_open_slots': {
        const args = listOpenSlotsArgs.parse(rawArgs);
        const tz = await companyTimezone(ctx.companyId);
        const slots = await generateDaySlots(ctx.companyId, args.serviceId, args.date);
        const open = slots.filter((s) => s.available).map((s) => ({ time: s.label, startAt: s.startAt }));
        const waitlist = slots.filter((s) => !s.available && s.waitlist).map((s) => ({ time: s.label, startAt: s.startAt }));
        // Nothing open on the requested day → surface the closest day that has room.
        let nextAvailable: { date: string; time: string; startAt: string }[] = [];
        if (open.length === 0) {
          const tomorrow = new Date(new Date(`${args.date}T00:00:00Z`).getTime() + DAY_MS);
          nextAvailable = await suggestAlternatives(ctx.companyId, args.serviceId, tomorrow, tz);
        }
        return ok({
          note: 'الأوقات مُنسّقة بتوقيت النشاط (نظام ١٢ ساعة). اقتبسها حرفياً ولا تعِد حسابها.',
          date: args.date, open, waitlist, nextAvailable,
        });
      }

      case 'check_availability': {
        const args = checkAvailabilityArgs.parse(rawArgs);
        const from = parseDate(args.from);
        const to = parseDate(args.to);
        if (!from || !to) return fail('صيغة التاريخ غير صحيحة. استخدم ISO 8601.');
        const tz = await companyTimezone(ctx.companyId);
        const booked = await db.booking.findMany({
          where: {
            companyId: ctx.companyId,
            status: { in: ['PENDING', 'CONFIRMED'] },
            startAt: { gte: from, lt: to },
          },
          orderBy: { startAt: 'asc' },
          take: 50,
          select: { title: true, startAt: true, endAt: true },
        });
        return ok({
          note: 'الأوقات مُنسّقة مسبقاً بتوقيت النشاط (نظام ١٢ ساعة). لا تحوّلها ولا تعيد حسابها.',
          booked: booked.map((b) => {
            const w = fmtWhen(b.startAt, tz);
            return { title: b.title, date: w.date, time: w.time };
          }),
          count: booked.length,
        });
      }

      case 'create_booking': {
        const args = createBookingArgs.parse(rawArgs);
        const startAt = parseDate(args.startAt);
        if (!startAt) return fail('صيغة التاريخ غير صحيحة. استخدم ISO 8601.');
        if (startAt.getTime() <= Date.now()) {
          return fail('لا يمكن الحجز في وقت مضى. اعرض على العميل موعداً قادماً عبر list_open_slots.');
        }
        const endAt = args.endAt ? parseDate(args.endAt) : null;

        if (args.serviceId) {
          const svc = await db.service.findFirst({
            where: { id: args.serviceId, companyId: ctx.companyId },
            select: { id: true },
          });
          if (!svc) return fail('الخدمة غير موجودة.');
        }

        // Every booking must belong to a real customer — the agent must have
        // collected who it's for. Verify an existing id, or find-or-create from
        // the name/phone it gathered; refuse a booking with no identity at all.
        let customerId = args.customerId;
        if (customerId) {
          const exists = await db.customer.findFirst({
            where: { id: customerId, companyId: ctx.companyId },
            select: { id: true },
          });
          if (!exists) return fail('العميل المرتبط غير موجود.');
        } else if (args.customerName) {
          // Reuse an existing customer before creating a duplicate: match on
          // phone first (most reliable), then fall back to an exact name match.
          let found = args.customerPhone
            ? await db.customer.findFirst({
                where: { companyId: ctx.companyId, phone: { contains: args.customerPhone } },
                select: { id: true },
              })
            : null;
          if (!found) {
            found = await db.customer.findFirst({
              where: {
                companyId: ctx.companyId,
                name: { equals: args.customerName, mode: Prisma.QueryMode.insensitive },
              },
              select: { id: true },
            });
          }
          if (found) {
            customerId = found.id;
          } else {
            const created = await db.customer.create({
              data: {
                companyId: ctx.companyId,
                ref: await nextRef(ctx.companyId, 'customer'),
                assignedAgentId: ctx.agentId,
                name: args.customerName,
                phone: args.customerPhone,
                status: 'NEW',
                source: 'agent-booking',
              },
              select: { id: true },
            });
            customerId = created.id;
          }
        } else {
          return fail(
            'قبل تثبيت الحجز اطلب اسم العميل ورقم جواله للتواصل والتأكيد، ثم مرّرهما (customerName و customerPhone) أو معرّف عميل موجود customerId.'
          );
        }

        // Route through the deterministic engine: when a serviceId is given it
        // enforces slot capacity atomically; otherwise it creates an ad-hoc booking.
        try {
          const booking = await createBooking({
            companyId: ctx.companyId,
            serviceId: args.serviceId,
            customerId,
            title: args.title,
            startAt,
            endAt,
            notes: args.notes,
            source: 'agent',
          });
          const waitlisted = booking.status === 'WAITLIST';
          const tz = await companyTimezone(ctx.companyId);
          const when = fmtWhen(booking.startAt, tz);
          return ok({
            booking: {
              id: booking.id,
              ref: booking.ref,
              title: booking.title,
              date: when.date,
              time: when.time,
              status: booking.status,
            },
            waitlisted,
            message: waitlisted
              ? 'الفترة ممتلئة، وسُجّل العميل في قائمة الانتظار — أخبره أنه سيُبلَّغ عند توفّر مكان.'
              : 'تم تأكيد الحجز. أكّد للعميل الخدمة والتاريخ والوقت ورقم الحجز.',
          });
        } catch (err) {
          if (err instanceof BookingError) {
            if (err.code === 'slot_full' && args.serviceId) {
              // Full and no waitlist — hand the agent real alternatives to offer.
              const tz = await companyTimezone(ctx.companyId);
              const suggestions = await suggestAlternatives(ctx.companyId, args.serviceId, startAt, tz);
              return JSON.stringify({
                ok: false,
                reason: 'slot_full',
                error:
                  'هذا الوقت ممتلئ ولا يتوفّر انتظار. اعرض على العميل الأوقات البديلة التالية واطلب منه الاختيار.',
                suggestions,
              });
            }
            const msg =
              err.code === 'slot_full'
                ? 'الفترة مكتملة، اقترح على العميل وقتاً آخر عبر list_open_slots.'
                : err.code === 'waitlist_full'
                  ? 'قائمة الانتظار لهذا الوقت ممتلئة أيضاً. اعرض على العميل أقرب وقت متاح آخر.'
                  : err.code === 'not_bookable'
                    ? 'هذه الخدمة غير مهيّأة للحجز بفترات (اضبط توفّرها أولاً).'
                    : 'تعذّر إنشاء الحجز في هذا الوقت.';
            return fail(msg);
          }
          throw err;
        }
      }

      case 'list_bookings': {
        const args = listBookingsArgs.parse(rawArgs);
        const tz = await companyTimezone(ctx.companyId);
        // Resolve the time window here so the model never computes ranges:
        //   date → that whole business-local day
        //   from/to → explicit range
        //   nothing → upcoming (now onward)
        let gte: Date | undefined;
        let lt: Date | undefined;
        if (args.date) {
          const r = localDayRange(args.date, tz);
          gte = r.from;
          lt = r.to;
        } else {
          const f = args.from ? parseDate(args.from) : null;
          const t2 = args.to ? parseDate(args.to) : null;
          if (args.from && !f) return fail('صيغة "from" غير صحيحة. استخدم ISO 8601 أو YYYY-MM-DD.');
          if (args.to && !t2) return fail('صيغة "to" غير صحيحة. استخدم ISO 8601 أو YYYY-MM-DD.');
          gte = f ?? (args.to ? undefined : new Date());
          lt = t2 ?? undefined;
        }
        const statusFilter: Prisma.BookingWhereInput = args.status
          ? { status: args.status as BookingStatus }
          : { status: { in: ['PENDING', 'CONFIRMED', 'WAITLIST'] as BookingStatus[] } };
        const bookings = await db.booking.findMany({
          where: {
            companyId: ctx.companyId,
            ...statusFilter,
            ...(gte || lt ? { startAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } } : {}),
            ...(args.customer
              ? {
                  customer: {
                    OR: [
                      { name: { contains: args.customer, mode: Prisma.QueryMode.insensitive } },
                      { phone: { contains: args.customer } },
                    ],
                  },
                }
              : {}),
            ...(args.staff
              ? { staffMember: { name: { contains: args.staff, mode: Prisma.QueryMode.insensitive } } }
              : {}),
          },
          orderBy: { startAt: 'asc' },
          take: 40,
          select: {
            id: true,
            ref: true,
            title: true,
            startAt: true,
            status: true,
            customer: { select: { name: true, phone: true } },
            staffMember: { select: { name: true } },
            service: { select: { title: true } },
          },
        });
        return ok({
          note: 'الأوقات مُنسّقة مسبقاً بتوقيت النشاط (نظام ١٢ ساعة). اعرضها كما هي دون تحويل.',
          count: bookings.length,
          bookings: bookings.map((b) => {
            const w = fmtWhen(b.startAt, tz);
            return {
              id: b.id,
              ref: b.ref,
              service: b.service?.title ?? b.title,
              customer: b.customer?.name ?? null,
              phone: b.customer?.phone ?? null,
              staff: b.staffMember?.name ?? null,
              date: w.date,
              time: w.time,
              status: b.status,
            };
          }),
        });
      }

      case 'set_booking_staff': {
        const args = setBookingStaffArgs.parse(rawArgs);
        const staff = await db.staffMember.findFirst({
          where: {
            companyId: ctx.companyId,
            isActive: true,
            name: { contains: args.staffName, mode: Prisma.QueryMode.insensitive },
          },
          select: { id: true, name: true },
        });
        if (!staff) return fail('لم أجد موظفاً بهذا الاسم ضمن الطاقم النشط. تحقّق من الاسم.');
        const result = await db.booking.updateMany({
          where: { id: args.bookingId, companyId: ctx.companyId },
          data: { staffMemberId: staff.id },
        });
        if (result.count === 0) return fail('لم يُعثر على الحجز.');
        return ok({ message: `تم إسناد الحجز إلى ${staff.name} لاحتساب العمولة.`, staff: staff.name });
      }

      case 'search_faq': {
        const args = searchFaqArgs.parse(rawArgs);
        const contains = args.query
          ? { contains: args.query, mode: Prisma.QueryMode.insensitive }
          : undefined;
        const items = await db.faqItem.findMany({
          where: {
            companyId: ctx.companyId,
            isActive: true,
            ...(contains ? { OR: [{ question: contains }, { answer: contains }] } : {}),
          },
          take: 10,
          orderBy: { sortOrder: 'asc' },
          select: { question: true, answer: true, category: true },
        });
        return ok({ faq: items });
      }

      case 'find_customer': {
        const args = findCustomerArgs.parse(rawArgs);
        if (!args.phone && !args.name) {
          return fail('حدّد جوالاً أو اسماً للبحث.');
        }
        const customers = await db.customer.findMany({
          where: {
            companyId: ctx.companyId,
            ...(args.phone ? { phone: { contains: args.phone } } : {}),
            ...(args.name
              ? { name: { contains: args.name, mode: Prisma.QueryMode.insensitive } }
              : {}),
          },
          take: 5,
          select: { id: true, name: true, phone: true, status: true, notes: true },
        });
        return ok({ customers });
      }

      case 'create_lead': {
        const args = createLeadArgs.parse(rawArgs);
        const customer = await db.customer.create({
          data: {
            companyId: ctx.companyId,
            ref: await nextRef(ctx.companyId, 'customer'),
            assignedAgentId: ctx.agentId,
            name: args.name,
            phone: args.phone,
            email: args.email,
            status: args.status ?? 'NEW',
            notes: args.notes,
            source: 'agent',
            customFields: (args.customFields as Prisma.InputJsonValue) ?? undefined,
          },
          select: { id: true, name: true, status: true },
        });
        // Fire LEAD_CREATED so any configured agent (e.g. sales) wakes up.
        await dispatchEvent(ctx.companyId, 'LEAD_CREATED', {
          summary: `عميل جديد: ${customer.name}`,
          metadata: { customerId: customer.id },
        });
        return ok({ customer, message: 'تم إنشاء سجل العميل.' });
      }

      case 'update_lead': {
        const args = updateLeadArgs.parse(rawArgs);
        // updateMany with companyId guard prevents cross-tenant writes.
        const result = await db.customer.updateMany({
          where: { id: args.customerId, companyId: ctx.companyId },
          data: {
            ...(args.name ? { name: args.name } : {}),
            ...(args.phone ? { phone: args.phone } : {}),
            ...(args.email ? { email: args.email } : {}),
            ...(args.status ? { status: args.status } : {}),
            ...(args.notes ? { notes: args.notes } : {}),
          },
        });
        if (result.count === 0) return fail('لم يُعثر على العميل.');
        return ok({ message: 'تم تحديث العميل.' });
      }

      case 'update_task_status': {
        const args = updateTaskStatusArgs.parse(rawArgs);
        const result = await db.task.updateMany({
          where: { id: args.taskId, companyId: ctx.companyId },
          data: {
            status: args.status,
            ...(args.status === 'DONE' ? { completedAt: new Date(), progress: 100 } : {}),
          },
        });
        if (result.count === 0) return fail('لم يُعثر على المهمة.');
        return ok({ message: 'تم تحديث حالة المهمة.' });
      }

      case 'update_booking': {
        const args = updateBookingArgs.parse(rawArgs);
        const startAt = parseDate(args.startAt);
        const endAt = parseDate(args.endAt);
        if (startAt === null || endAt === null) return fail('صيغة التاريخ غير صحيحة.');
        const result = await db.booking.updateMany({
          where: { id: args.bookingId, companyId: ctx.companyId },
          data: {
            ...(startAt ? { startAt } : {}),
            ...(endAt ? { endAt } : {}),
            ...(args.status ? { status: args.status } : {}),
          },
        });
        if (result.count === 0) return fail('لم يُعثر على الحجز.');
        return ok({ message: 'تم تحديث الحجز.' });
      }

      case 'create_order': {
        const args = createOrderArgs.parse(rawArgs);
        if (args.customerId) {
          const exists = await db.customer.findFirst({
            where: { id: args.customerId, companyId: ctx.companyId },
            select: { id: true },
          });
          if (!exists) return fail('العميل المرتبط غير موجود.');
        }
        // Optional coupon redemption — validated against scope, window, min
        // subtotal, and remaining redemptions before it discounts the total.
        let couponId: string | undefined;
        let discount = 0;
        if (args.couponCode) {
          const coupon = await db.coupon.findFirst({
            where: { companyId: ctx.companyId, code: args.couponCode.toUpperCase() },
          });
          const nowD = new Date();
          const orderScope = (args.type ?? 'SERVICE') === 'PRODUCT' ? 'PRODUCTS' : 'SERVICES';
          const valid =
            coupon &&
            coupon.isActive &&
            (!coupon.startsAt || coupon.startsAt <= nowD) &&
            (!coupon.expiresAt || coupon.expiresAt >= nowD) &&
            (coupon.maxRedemptions == null || coupon.usedCount < coupon.maxRedemptions) &&
            (coupon.scope === 'ALL' || coupon.scope === orderScope) &&
            (!coupon.minSubtotal || args.total >= Number(coupon.minSubtotal));
          if (valid && coupon) {
            discount =
              coupon.type === 'PERCENT'
                ? Math.round(((args.total * Number(coupon.value)) / 100) * 100) / 100
                : Math.min(args.total, Number(coupon.value));
            couponId = coupon.id;
          } else {
            return fail('الكوبون غير صالح أو منتهٍ أو لا ينطبق على هذا الطلب.');
          }
        }
        const finalTotal = Math.max(0, args.total - discount);

        const order = await db.order.create({
          data: {
            companyId: ctx.companyId,
            orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
            type: args.type ?? 'SERVICE',
            customerId: args.customerId,
            customerName: args.customerName,
            customerNotes: args.notes,
            subtotal: args.total,
            discount,
            total: finalTotal,
            couponId,
            agentId: ctx.agentId,
          },
          select: { id: true, orderNumber: true },
        });
        // Count the redemption once the order is actually placed.
        if (couponId) {
          await db.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
        }
        // A placed order is a realized deal → advance the opportunity to WON.
        if (args.customerId) {
          await db.customer.update({ where: { id: args.customerId }, data: { status: 'WON' } });
        }
        // Fire ORDER_CREATED so a configured agent follows up automatically.
        await dispatchEvent(ctx.companyId, 'ORDER_CREATED', {
          summary: `طلب جديد ${order.orderNumber} للعميل ${args.customerName}`,
          metadata: { orderId: order.id },
        });
        return ok({ order, message: 'تم تسجيل الطلب.' });
      }

      case 'create_task': {
        const args = createTaskArgs.parse(rawArgs);
        const dueAt = parseDate(args.dueAt);
        const startAt = parseDate(args.startAt);
        const endAt = parseDate(args.endAt);
        if (dueAt === null || startAt === null || endAt === null) {
          return fail('صيغة التاريخ غير صحيحة. استخدم ISO 8601.');
        }

        // If a customer is referenced, confirm it belongs to this company.
        if (args.customerId) {
          const exists = await db.customer.findFirst({
            where: { id: args.customerId, companyId: ctx.companyId },
            select: { id: true },
          });
          if (!exists) return fail('العميل المرتبط غير موجود.');
        }

        const task = await db.task.create({
          data: {
            companyId: ctx.companyId,
            agentId: ctx.agentId,
            kind: args.kind ?? 'AGENT_TASK',
            customerId: args.customerId,
            title: args.title,
            description: args.description ?? args.title,
            triggerType: 'AGENT_TOOL',
            dueAt: dueAt ?? undefined,
            startAt: startAt ?? undefined,
            endAt: endAt ?? undefined,
          },
          select: { id: true, title: true, kind: true },
        });
        return ok({ task, message: 'تمت إضافة البند للجدول.' });
      }

      case 'save_memory': {
        const args = saveMemoryArgs.parse(rawArgs);
        await saveMemory({
          agentId: ctx.agentId,
          companyId: ctx.companyId,
          summary: args.summary,
          importance: args.importance,
          category: args.category,
        });
        return ok({ message: 'تم الحفظ في الذاكرة.' });
      }

      case 'request_approval': {
        const args = requestApprovalArgs.parse(rawArgs);
        // The agent pauses a sensitive decision for the owner (two-layer
        // contract). Creates the approval + a timeline entry; resolveApproval
        // (owner action) later wakes the agent to continue or revise.
        const approval = await db.approval.create({
          data: {
            companyId: ctx.companyId,
            agentId: ctx.agentId,
            decision: args.decision,
            context: args.context ?? null,
            options: ['approve', 'reject'],
            status: 'PENDING',
          },
          select: { id: true },
        });
        await db.timelineEvent.create({
          data: {
            companyId: ctx.companyId,
            agentId: ctx.agentId,
            type: 'APPROVAL_REQUESTED',
            title: 'طلب موافقة',
            description: args.decision,
          },
        });
        return ok({
          approvalId: approval.id,
          message: 'تم رفع القرار لصاحب العمل للموافقة. لن أنفّذه حتى يوافق.',
        });
      }

      case 'create_output': {
        const args = createOutputArgs.parse(rawArgs);
        // Optionally link the deliverable to a known customer (best-effort).
        let customerId: string | undefined;
        if (args.customerName) {
          const c = await db.customer.findFirst({
            where: {
              companyId: ctx.companyId,
              name: { equals: args.customerName, mode: Prisma.QueryMode.insensitive },
            },
            select: { id: true },
          });
          customerId = c?.id;
        }
        const output = await db.agentOutput.create({
          data: {
            companyId: ctx.companyId,
            agentId: ctx.agentId,
            type: args.type as AgentOutputType,
            status: (args.status ?? 'READY') as AgentOutputStatus,
            title: args.title,
            body: args.body,
            customerId,
          },
          select: { id: true, title: true, type: true, status: true },
        });
        // Surface it on the timeline so the owner sees the delivery happen.
        await db.timelineEvent.create({
          data: {
            companyId: ctx.companyId,
            agentId: ctx.agentId,
            type: 'OUTPUT_DELIVERED',
            title: 'تسليم مخرج',
            description: args.title,
          },
        });
        return ok({
          output,
          message: 'تم تسليم المخرج إلى مساحة عمل الوكلاء لعرضه على صاحب العمل.',
        });
      }

      case 'delegate_to_agent': {
        const args = delegateToAgentArgs.parse(rawArgs);
        // Find an ACTIVE colleague by name or role — never yourself, never a
        // paused/archived agent (a paused agent's tasks wouldn't run anyway).
        const colleague = await db.agent.findFirst({
          where: {
            companyId: ctx.companyId,
            id: { not: ctx.agentId },
            status: { notIn: ['ARCHIVED', 'PAUSED'] },
            OR: [
              { name: { contains: args.colleague, mode: Prisma.QueryMode.insensitive } },
              { nameEn: { contains: args.colleague, mode: Prisma.QueryMode.insensitive } },
              { role: { contains: args.colleague, mode: Prisma.QueryMode.insensitive } },
              { roleEn: { contains: args.colleague, mode: Prisma.QueryMode.insensitive } },
            ],
          },
          select: { id: true, name: true, role: true },
        });
        if (!colleague) {
          return fail('لم أجد زميلاً نشطاً بهذا الاسم أو الدور. تحقّق من الوكلاء المتاحين أو نفّذ المهمة بنفسك.');
        }
        // Optional dependency: gate this task behind an earlier one (same tenant).
        let dependsOn: string[] = [];
        if (args.afterTaskId) {
          const dep = await db.task.findFirst({
            where: { id: args.afterTaskId, companyId: ctx.companyId },
            select: { id: true },
          });
          if (!dep) return fail('المهمة السابقة (afterTaskId) غير موجودة. تأكّد من المعرّف الذي أعادته أداة التفويض السابقة.');
          dependsOn = [dep.id];
        }
        // Assign it as a PENDING AGENT_TOOL task; the scheduler's task runner
        // (runDueTasks) picks it up and the colleague executes it autonomously —
        // and, when dependsOn is set, only after that dependency is DONE.
        const task = await db.task.create({
          data: {
            companyId: ctx.companyId,
            agentId: colleague.id,
            kind: 'AGENT_TASK',
            title: args.task.slice(0, 200),
            description: args.note ? `${args.task}\n\nسياق من الزميل: ${args.note}` : args.task,
            triggerType: 'AGENT_TOOL',
            triggerSource: { delegatedByAgentId: ctx.agentId },
            dependsOn,
          },
          select: { id: true },
        });
        await db.timelineEvent.create({
          data: {
            companyId: ctx.companyId,
            agentId: ctx.agentId,
            type: 'AGENT_HANDOFF',
            title: 'تفويض مهمة لزميل',
            description: `إلى ${colleague.name}: ${args.task.slice(0, 140)}`,
          },
        });
        return ok({
          delegatedTo: colleague.name,
          taskId: task.id,
          message: dependsOn.length
            ? `فوّضت المهمة إلى ${colleague.name} (${colleague.role})، وستُنفَّذ تلقائياً بعد انتهاء المهمة السابقة.`
            : `فوّضت المهمة إلى ${colleague.name} (${colleague.role})، وسينفّذها تلقائياً.`,
        });
      }

      default:
        return fail(`أداة غير معروفة: ${name}`);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(`مدخلات غير صحيحة: ${err.issues.map((i) => i.message).join('; ')}`);
    }
    console.error('Tool execution error', { name, ctx, err });
    return fail('تعذّر تنفيذ الأداة.');
  }
}
