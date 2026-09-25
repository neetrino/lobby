import { Injectable } from '@nestjs/common';
import type { ContactCreatedEvent, TenantCreatedEvent } from '@lobby/contracts';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

type OutboxEnqueueEvent = ContactCreatedEvent | TenantCreatedEvent;

@Injectable()
export class OutboxService {
  /** Writes one outbox row on the caller's transaction. Does not open another transaction. */
  async enqueue(tx: Prisma.TransactionClient, event: OutboxEnqueueEvent): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: event.eventId,
        tenantId: event.tenantId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        occurredAt: new Date(event.occurredAt),
        payload: event.payload,
      },
    });
  }
}
