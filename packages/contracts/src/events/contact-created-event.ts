import { z } from 'zod';

import { versionedEventSchema } from './versioned-event.js';

export const contactCreatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('contact.created'),
  aggregateType: z.literal('contact'),
  payload: z.object({
    name: z.string().trim().min(1),
  }),
});

export type ContactCreatedEvent = z.infer<typeof contactCreatedEventSchema>;
