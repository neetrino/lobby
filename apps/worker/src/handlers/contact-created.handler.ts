import type { ContactCreatedEvent } from '@lobby/contracts';

/** In-process idempotency for at-least-once delivery of one event id. */
export class ContactCreatedHandler {
  private readonly deliveredEventIds = new Set<string>();

  async handle(event: ContactCreatedEvent): Promise<void> {
    if (this.deliveredEventIds.has(event.eventId)) {
      return;
    }
    this.deliveredEventIds.add(event.eventId);
  }

  deliveryCount(): number {
    return this.deliveredEventIds.size;
  }
}
