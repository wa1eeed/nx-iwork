import { z } from 'zod';

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(4000).default(''),
  // The agent that will perform it. Required for AGENT_TASK; appointments/
  // reminders may be agent-less (handled by the UI defaulting to AGENT_TASK).
  agentId: z.string().trim().min(1),
  kind: z.enum(['AGENT_TASK', 'APPOINTMENT', 'REMINDER']).default('AGENT_TASK'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  dueAt: z.string().trim().optional().nullable(),
});

export type TaskInput = z.infer<typeof taskSchema>;
