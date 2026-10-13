import { tenantSubdomainSchema } from '@lobby/contracts';
import { z } from 'zod';

import { passwordPolicySchema } from '../../identity';

const requiredName = z.string().trim().min(1);

const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());

/** Company workspace plus its first owner. The platform operator is not a member. */
export const provisionOrganizationSchema = z.strictObject({
  tenant: z.strictObject({
    name: requiredName,
    subdomain: tenantSubdomainSchema,
  }),
  owner: z.strictObject({
    name: requiredName,
    email: normalizedEmail,
    password: passwordPolicySchema,
  }),
});

export type ProvisionOrganizationInput = z.infer<typeof provisionOrganizationSchema>;

export const platformAdminSchema = z.strictObject({
  name: requiredName,
  email: normalizedEmail,
  password: passwordPolicySchema,
});

export type PlatformAdminInput = z.infer<typeof platformAdminSchema>;
