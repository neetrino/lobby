import type { ContactCreatedEvent } from '@lobby/contracts';

/**
 * Placeholder consumer for `contact.created`.
 * No external side effect, so the registry does not attach a durable idempotency key.
 * The in-memory set only skips duplicate work inside one process.
 */
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
