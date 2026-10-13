import { z } from 'zod';

import { versionedEventSchema } from './versioned-event.js';

export const CONTACT_UPDATED_EVENT_VERSION = 1;

/**
 * Name only. Email and phone stay out of the event payload.
 * This schema is not written to the outbox until a module consumes `contact.updated`.
 */
export const contactUpdatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('contact.updated'),
  eventVersion: z.literal(CONTACT_UPDATED_EVENT_VERSION),
  aggregateType: z.literal('contact'),
  payload: z.object({
    name: z.string().trim().min(1),
  }),
});

export type ContactUpdatedEvent = z.infer<typeof contactUpdatedEventSchema>;
