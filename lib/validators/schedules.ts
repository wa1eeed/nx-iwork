import { z } from 'zod';

// A recurring "wake trigger" for an agent: at each cron tick, the scheduler
// turns taskTemplate into a task and runs it.
export const scheduleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).optional().nullable(),
  // Standard 5-field cron. Validated against a parser in the action.
  cronExpression: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(60).default('Asia/Riyadh'),
  // The instruction handed to the agent each run.
  taskTemplate: z.string().trim().min(1).max(4000),
  isActive: z.boolean().default(true),
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;
