import { z } from 'zod';

// Catalog product. customFields is the flexible-per-business escape hatch
// (color, warranty_months, model_year, …) — free key/value pairs the agent can
// read via search_catalog.
export const productSchema = z.object({
  title: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(4000).default(''),
  price: z.coerce.number().nonnegative().max(99_999_999),
  comparePrice: z.coerce.number().nonnegative().max(99_999_999).optional().nullable(),
  sku: z.string().trim().max(80).optional().nullable(),
  // -1 = unlimited (matches schema default).
  stock: z.coerce.number().int().min(-1).max(1_000_000).default(-1),
  images: z.array(z.string().url()).max(8).default([]),
  isActive: z.boolean().default(true),
  customFields: z.record(z.string().max(2000)).default({}),
});

export type ProductInput = z.infer<typeof productSchema>;
