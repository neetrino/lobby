import { z } from 'zod';

/** Only the starter plan is approved. Do not add priced plans without a product decision. */
export const tenantPlans = ['starter'] as const;

export const tenantPlanSchema = z.enum(tenantPlans);

export type TenantPlan = z.infer<typeof tenantPlanSchema>;

/** Single DNS label, stored lowercase. */
export const tenantSubdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
