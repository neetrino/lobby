import type { TenantCreatedEvent, TenantCreatedEventV1 } from '@lobby/contracts';

/**
 * Placeholder consumer for `tenant.created` versions 1 and 2.
 * No external side effect, so the registry does not attach a durable idempotency key.
 * The in-memory set only skips duplicate work inside one process.
 * A durable idempotency record is required before this handler sends mail or calls a third party.
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
