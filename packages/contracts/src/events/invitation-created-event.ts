import { z } from 'zod';

import { localeSchema } from '../locales.js';
import { versionedEventSchema } from './versioned-event.js';

export const INVITATION_CREATED_EVENT_VERSION = 1;

/**
 * Delivery job for one member invitation.
 * `tokenCiphertext` is an AES-256-GCM seal. The raw token is not a field.
 */
export const invitationCreatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('invitation.created'),
  eventVersion: z.literal(INVITATION_CREATED_EVENT_VERSION),
  aggregateType: z.literal('memberInvitation'),
  payload: z.object({
    recipientEmail: z.email(),
    invitationId: z.uuid(),
    locale: localeSchema,
    organizationName: z.string().trim().min(1),
    inviterName: z.string().trim().min(1),
    tokenCiphertext: z.string().trim().min(1),
  }),
});

export type InvitationCreatedEvent = z.infer<typeof invitationCreatedEventSchema>;
