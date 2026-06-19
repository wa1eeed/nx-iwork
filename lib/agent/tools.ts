// The tools an AI employee can call. This is the heart of "doing" instead of
// just "chatting": reading the structured catalog (cheap, exact — no PDF
// scanning), capturing leads into the CRM, and booking tasks/appointments.
//
// Every executor is scoped by companyId, so an agent can only ever touch its
// own company's data. Each returns a short JSON string that goes back to the
// model as the tool result.

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { AiTool } from '@/lib/ai';
import { saveMemory } from './memory';
import { dispatchEvent } from './events';

export interface ToolContext {
  companyId: string;
  agentId: string;
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
          enum: ['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST'],
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
    description: 'حدّث حالة أو ملاحظات عميل موجود في الـ CRM (مثلاً من مهتم إلى اشترى).',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'معرّف العميل من find_customer' },
        status: {
          type: 'string',
          enum: ['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST'],
        },
        notes: { type: 'string' },
      },
      required: ['customerId'],
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
];

// ---- Executors -------------------------------------------------------------

const searchCatalogArgs = z.object({
  query: z.string().trim().optional(),
  kind: z.enum(['service', 'product', 'all']).optional(),
});

const searchFaqArgs = z.object({
  query: z.string().trim().optional(),
});

const findCustomerArgs = z.object({
  phone: z.string().trim().optional(),
  name: z.string().trim().optional(),
});

const createLeadArgs = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(200).optional(),
  status: z.enum(['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST']).optional(),
  notes: z.string().trim().max(2000).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const updateLeadArgs = z.object({
  customerId: z.string().trim().min(1),
  status: z.enum(['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST']).optional(),
  notes: z.string().trim().max(2000).optional(),
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
            ...(args.status ? { status: args.status } : {}),
            ...(args.notes ? { notes: args.notes } : {}),
          },
        });
        if (result.count === 0) return fail('لم يُعثر على العميل.');
        return ok({ message: 'تم تحديث العميل.' });
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
