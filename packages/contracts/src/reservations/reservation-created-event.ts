import { z } from 'zod';

import { versionedEventSchema } from '../events/versioned-event.js';

export const RESERVATION_CREATED_EVENT_VERSION = 1;

export const reservationCreatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('reservation.created'),
  eventVersion: z.literal(RESERVATION_CREATED_EVENT_VERSION),
  aggregateType: z.literal('reservation'),
  payload: z.object({
    venueId: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    partySize: z.number().int().positive(),
    tableIds: z.array(z.uuid()).min(1),
  }),
});

export type ReservationCreatedEvent = z.infer<typeof reservationCreatedEventSchema>;
