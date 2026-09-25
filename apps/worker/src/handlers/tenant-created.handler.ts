import type { TenantCreatedEvent } from '@lobby/contracts';

/** In-process idempotency for at-least-once delivery of one event id. */
export class TenantCreatedHandler {
  private readonly deliveredEventIds = new Set<string>();

  async handle(event: TenantCreatedEvent): Promise<void> {
    if (this.deliveredEventIds.has(event.eventId)) {
      return;
    }
    this.deliveredEventIds.add(event.eventId);
  }

  deliveryCount(): number {
    return this.deliveredEventIds.size;
  }
}
