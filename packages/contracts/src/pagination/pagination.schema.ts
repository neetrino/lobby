import { z } from 'zod';

/** Default collection page size. */
export const DEFAULT_PAGE_LIMIT = 50;

/** Maximum collection page size. */
export const MAX_PAGE_LIMIT = 100;

/** Shared page size. The resource schema decides every other query field. */
export const pageLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE_LIMIT)
  .default(DEFAULT_PAGE_LIMIT);

/** Shared direction. The resource schema decides which field it applies to. */
export const sortDirectionSchema = z.enum(['asc', 'desc']);

export type SortDirection = z.infer<typeof sortDirectionSchema>;
