import { z } from 'zod';

/** Practical minimum for a user-chosen password. */
export const PASSWORD_MIN_LENGTH = 12;

/** Hard cap so password hashing cannot be used as a request-size DoS. */
export const PASSWORD_MAX_LENGTH = 128;

const lengthPolicyMessage = 'Password does not meet the length policy.';

/** Reusable plaintext password rule. Does not accept or describe a password hash. */
export const passwordPolicySchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, lengthPolicyMessage)
  .max(PASSWORD_MAX_LENGTH, lengthPolicyMessage);

export type Password = z.infer<typeof passwordPolicySchema>;
