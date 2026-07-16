import { z } from 'zod';

// FAQ item — structured business knowledge the agents read via search_faq.
export const faqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(4000),
  category: z.string().trim().max(60).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type FaqInput = z.infer<typeof faqSchema>;

// Event trigger — "when EVENT happens, wake AGENT with this task". The enum
// mirrors TRIGGER_EVENTS (lib/agent/events-catalog.ts) — the single catalog all
// three trigger UIs share; extend both together when adding a TriggerEvent.
export const triggerSchema = z.object({
  event: z.enum(['LEAD_CREATED', 'ORDER_CREATED', 'ORDER_PAID', 'CART_ABANDONED', 'COMPLAINT_RECEIVED']),
  agentId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  taskTemplate: z.string().trim().min(1).max(4000),
  isActive: z.boolean().default(true),
});

export type TriggerInput = z.infer<typeof triggerSchema>;
