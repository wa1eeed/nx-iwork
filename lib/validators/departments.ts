import { z } from 'zod';

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export const departmentSchema = z.object({
  name: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().max(60).optional().nullable(),
  icon: z.string().trim().min(1).max(40).default('briefcase'),
  color: z.string().regex(HEX_COLOR).default('#06b6d4'),
  description: z.string().trim().max(500).optional().nullable(),
  // Customer-facing: show this department as a "clinic"/category section on the
  // public landing page, with an optional tagline.
  landingVisible: z.boolean().optional().default(true),
  tagline: z.string().trim().max(160).optional().nullable(),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
