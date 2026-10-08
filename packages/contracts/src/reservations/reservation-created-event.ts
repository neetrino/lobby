import { z } from 'zod';

import { versionedEventSchema } from '../events/versioned-event.js';
import { reservationSources } from './create-reservation.js';

export const RESERVATION_CREATED_EVENT_VERSION = 1;

/**
 * Booking created. Phone, email, and notes stay off this payload.
 */
export const reservationCreatedEventSchema = versionedEventSchema.extend({
  eventType: z.literal('reservation.created'),
  eventVersion: z.literal(RESERVATION_CREATED_EVENT_VERSION),
  aggregateType: z.literal('reservation'),
  payload: z.strictObject({
    reservationId: z.uuid(),
    locationId: z.uuid(),
    contactId: z.uuid().nullable(),
    source: z.enum(reservationSources),
    status: z.literal('PENDING'),
    startsAt: z.iso.datetime(),
  }),
});

export type ReservationCreatedEvent = z.infer<typeof reservationCreatedEventSchema>;
