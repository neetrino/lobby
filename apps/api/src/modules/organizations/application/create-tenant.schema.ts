import { z } from 'zod';
import { passwordHashSchema, tenantPlanSchema, tenantSubdomainSchema } from '@lobby/contracts';

const requiredName = z.string().trim().min(1);

const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Command accepted from Auth. The client cannot set identity, role, or status.
 * `passwordHash` is produced by Auth; this module never accepts a plaintext password.
 */
export const createTenantWithOwnerSchema = z.strictObject({
  tenant: z.strictObject({
    name: requiredName,
    subdomain: tenantSubdomainSchema,
    plan: tenantPlanSchema,
  }),
  owner: z.strictObject({
    name: requiredName,
    email: normalizedEmail,
    passwordHash: passwordHashSchema,
  }),
});

export type CreateTenantWithOwnerInput = z.infer<typeof createTenantWithOwnerSchema>;
