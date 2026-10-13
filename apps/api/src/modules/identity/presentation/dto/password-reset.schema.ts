import { localeSchema, tenantSubdomainSchema } from '@lobby/contracts';
import { z } from 'zod';

import { passwordPolicySchema } from '../../domain/password-policy';

const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());

export const requestPasswordResetSchema = z.strictObject({
  subdomain: tenantSubdomainSchema,
  email: normalizedEmail,
  locale: localeSchema,
});

export const confirmPasswordResetSchema = z.strictObject({
  token: z.string().trim().min(20).max(200),
  password: passwordPolicySchema,
});

export type RequestPasswordResetBody = z.infer<typeof requestPasswordResetSchema>;
export type ConfirmPasswordResetBody = z.infer<typeof confirmPasswordResetSchema>;
