import { z } from "zod";

/**
 * Public contract for a yacht. The web app validates responses against the
 * same shape, so a change here is a change to both repositories.
 */
export const yachtSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  model: z.string().min(1),
  lengthOverallMeters: z.number().positive(),
  beamMeters: z.number().positive(),
  draftMeters: z.number().positive(),
  yearBuilt: z.number().int().min(1900).max(2100),
  heroImageUrl: z.url().nullable(),
  summary: z.string(),
});

export const yachtListSchema = z.object({
  items: z.array(yachtSchema),
  total: z.number().int().nonnegative(),
});

export const listYachtsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const yachtSlugParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a kebab-case slug"),
});

export type Yacht = z.infer<typeof yachtSchema>;
export type YachtList = z.infer<typeof yachtListSchema>;
export type ListYachtsQuery = z.infer<typeof listYachtsQuerySchema>;
