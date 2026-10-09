import { randomUUID } from 'node:crypto';
import {
  CONTACT_CREATED_EVENT_VERSION,
  contactCreatedEventSchema,
  type ContactCreatedEvent,
} from '@lobby/contracts';

/** Outbox payload is the name only. Email and phone are not included. */
export function contactCreatedEvent(
  tenantId: string,
  contactId: string,
  name: string,
): ContactCreatedEvent {
  return contactCreatedEventSchema.parse(
    envelope('contact.created', CONTACT_CREATED_EVENT_VERSION, tenantId, contactId, { name }),
  );
}

function envelope(
  eventType: string,
  eventVersion: number,
  tenantId: string,
  contactId: string,
  payload: { name: string },
) {
  return {
    eventId: randomUUID(),
    eventType,
    eventVersion,
    tenantId,
    aggregateType: 'contact',
    aggregateId: contactId,
    occurredAt: new Date().toISOString(),
    payload,
  };
}
