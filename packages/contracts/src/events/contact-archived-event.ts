import { z } from 'zod';

import { versionedEventSchema } from './versioned-event.js';

export const CONTACT_ARCHIVED_EVENT_VERSION = 1;

/**
 * Archive instant only. Email and phone stay out of the event payload.
 * This schema is not written to the outbox until a module consumes `contact.archived`.
 */
export const contactArchivedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('contact.archived'),
  eventVersion: z.literal(CONTACT_ARCHIVED_EVENT_VERSION),
  aggregateType: z.literal('contact'),
  payload: z.object({
    archivedAt: z.iso.datetime(),
  }),
});

export type ContactArchivedEvent = z.infer<typeof contactArchivedEventSchema>;
