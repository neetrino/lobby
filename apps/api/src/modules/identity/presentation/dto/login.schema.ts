import { tenantSubdomainSchema } from '@lobby/contracts';
import { z } from 'zod';

import { PASSWORD_MAX_LENGTH } from '../../domain/password-policy';

const normalizedEmail = z.string().trim().toLowerCase().pipe(z.email());
const lengthPolicyMessage = 'Password does not meet the length policy.';

/**
 * Login body. Maximum length blocks hashing abuse.
 * Minimum length is not applied here, so a short password still reaches verification.
 */
export const loginSchema = z.strictObject({
  subdomain: tenantSubdomainSchema,
  email: normalizedEmail,
  password: z.string().min(1, lengthPolicyMessage).max(PASSWORD_MAX_LENGTH, lengthPolicyMessage),
});

export type LoginInput = z.infer<typeof loginSchema>;
