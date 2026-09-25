import type { TenantCreatedEvent, TenantCreatedEventV1 } from '@lobby/contracts';

/**
 * Placeholder consumer for `tenant.created`.
 * It performs no external side effect. The in-memory set is not durable idempotency:
 * a restarted worker can observe the same event again. A `processed_events` record
 * is required before this handler sends mail, notifications, or any other effect.
 */
export class TenantCreatedHandler {
  private readonly deliveredEventIds = new Set<string>();

  async handle(event: TenantCreatedEvent | TenantCreatedEventV1): Promise<void> {
    if (this.deliveredEventIds.has(event.eventId)) {
      return;
    }
    this.deliveredEventIds.add(event.eventId);
  }

  deliveryCount(): number {
    return this.deliveredEventIds.size;
  }
}
