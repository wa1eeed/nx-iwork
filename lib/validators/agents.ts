import { z } from 'zod';

// AI employee definition. The persona + systemPrompt are the "character"; model
// and temperature tune behaviour. tier maps to a provider model in lib/ai.
export const agentSchema = z.object({
  name: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().max(60).optional().nullable(),
  role: z.string().trim().min(1).max(80),
  roleEn: z.string().trim().max(80).optional().nullable(),
  persona: z.string().trim().min(1).max(4000),
  // Job Description "constitution" — mandate + responsibilities + boundaries
  // (distinct from persona=personality). Governs the agent's decisions.
  jobDescription: z.string().trim().max(4000).optional().nullable(),
  departmentId: z.string().trim().min(1),
  // Optional manager (another agent in the same company).
  parentId: z.string().trim().optional().nullable(),
  model: z.enum(['HAIKU', 'SONNET', 'OPUS']).default('HAIKU'),
  temperature: z.coerce.number().min(0).max(1).default(0.6),
  maxTokens: z.coerce.number().int().min(256).max(8192).default(4096),
  systemPrompt: z.string().trim().max(4000).optional().nullable(),
  // Explicit tool-call allow-list. Empty = all module tools.
  permissions: z.array(z.string().trim().max(60)).max(40).optional(),
});

export type AgentInput = z.infer<typeof agentSchema>;
