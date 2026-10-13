import { z } from 'zod';

import { localeSchema } from '../locales.js';
import { versionedEventSchema } from './versioned-event.js';

export const PASSWORD_RESET_REQUESTED_EVENT_VERSION = 1;

/**
 * Delivery job for one password-reset email.
 * `tokenCiphertext` is an AES-256-GCM seal. The raw token is not a field.
 */
export const passwordResetRequestedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('password_reset.requested'),
  eventVersion: z.literal(PASSWORD_RESET_REQUESTED_EVENT_VERSION),
  aggregateType: z.literal('passwordReset'),
  payload: z.object({
    recipientEmail: z.email(),
    resetId: z.uuid(),
    locale: localeSchema,
    organizationName: z.string().trim().min(1),
    tokenCiphertext: z.string().trim().min(1),
  }),
});

export type PasswordResetRequestedEvent = z.infer<typeof passwordResetRequestedEventSchema>;
