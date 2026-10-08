import { randomUUID } from 'node:crypto';
import {
  RESERVATION_CREATED_EVENT_VERSION,
  reservationCreatedEventSchema,
  type ReservationCreatedEvent,
  type ReservationSource,
} from '@lobby/contracts';

type ReservationEventInput = {
  tenantId: string;
  reservationId: string;
  locationId: string;
  contactId: string | null;
  source: ReservationSource;
  startsAt: Date;
};

/** Outbox payload omits phone, email, and notes. */
export function reservationCreatedEvent(input: ReservationEventInput): ReservationCreatedEvent {
  return reservationCreatedEventSchema.parse({
    eventId: randomUUID(),
    eventType: 'reservation.created',
    eventVersion: RESERVATION_CREATED_EVENT_VERSION,
    tenantId: input.tenantId,
    aggregateType: 'reservation',
    aggregateId: input.reservationId,
    occurredAt: new Date().toISOString(),
    payload: {
      reservationId: input.reservationId,
      locationId: input.locationId,
      contactId: input.contactId,
      source: input.source,
      status: 'PENDING',
      startsAt: input.startsAt.toISOString(),
    },
  });
}
