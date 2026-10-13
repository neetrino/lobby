import type { ReservationCreatedEvent } from '@lobby/contracts';

/**
 * Placeholder consumer for `reservation.created`.
 * No external side effect, so the registry does not attach a durable idempotency key.
 * The in-memory set only skips duplicate work inside one process.
 */
export class ReservationCreatedHandler {
  private readonly deliveredEventIds = new Set<string>();

  async handle(event: ReservationCreatedEvent): Promise<void> {
    if (this.deliveredEventIds.has(event.eventId)) {
      return;
    }
    this.deliveredEventIds.add(event.eventId);
  }

  deliveryCount(): number {
    return this.deliveredEventIds.size;
  }
}
