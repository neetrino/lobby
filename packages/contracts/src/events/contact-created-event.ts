import { z } from 'zod';

import { versionedEventSchema } from './versioned-event.js';

export const CONTACT_CREATED_EVENT_VERSION = 1;

export const contactCreatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('contact.created'),
  eventVersion: z.literal(CONTACT_CREATED_EVENT_VERSION),
  aggregateType: z.literal('contact'),
  payload: z.object({
    name: z.string().trim().min(1),
  }),
});

export type ContactCreatedEvent = z.infer<typeof contactCreatedEventSchema>;
