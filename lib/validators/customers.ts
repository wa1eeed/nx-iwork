import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  status: z.enum(['NEW', 'INTERESTED', 'NEGOTIATING', 'WON', 'LOST']),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
