import { tenantPlanSchema, tenantSubdomainSchema } from '@lobby/contracts';
import { z } from 'zod';

import { passwordPolicySchema } from '../../domain/password-policy';

const requiredName = z.string().trim().min(1);
const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());

/**
 * Public registration body. The plaintext password stays in Identity.
 * Organizations receives only the hash produced later.
 */
export const registerSchema = z.strictObject({
  tenant: z.strictObject({
    name: requiredName,
    subdomain: tenantSubdomainSchema,
    plan: tenantPlanSchema,
  }),
  owner: z.strictObject({
    name: requiredName,
    email: normalizedEmail,
    password: passwordPolicySchema,
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
