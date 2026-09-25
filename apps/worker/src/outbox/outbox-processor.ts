import { contactCreatedEventSchema, type ContactCreatedEvent } from '@lobby/contracts';
import type { OutboxEventRecord, OutboxWorkerConfig } from '@lobby/database';

import type { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import type { OutboxRepository } from './outbox-repository.js';
import { sanitizeOutboxError } from './sanitize-outbox-error.js';

export class OutboxProcessor {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly handler: ContactCreatedHandler,
    private readonly config: OutboxWorkerConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async process(record: OutboxEventRecord): Promise<void> {
    let event: ContactCreatedEvent;
    try {
      event = parseStoredEvent(record);
    } catch (error) {
      await this.recordFailure(record, error);
      return;
    }

    try {
      await this.handler.handle(event);
      await this.repository.markPublished(record.id, this.now());
    } catch (error) {
      await this.recordFailure(record, error);
    }
  }

  private async recordFailure(record: OutboxEventRecord, error: unknown): Promise<void> {
    const lastError = sanitizeOutboxError(error);
    if (record.attempts >= this.config.maxAttempts) {
      await this.repository.markFailed(record.id, lastError);
      return;
    }
    await this.repository.markRetry(record.id, record.attempts, lastError);
  }
}

function parseStoredEvent(record: OutboxEventRecord): ContactCreatedEvent {
  return contactCreatedEventSchema.parse({
    eventId: record.id,
    eventType: record.eventType,
    eventVersion: record.eventVersion,
    tenantId: record.tenantId,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    occurredAt: record.occurredAt.toISOString(),
    payload: record.payload,
  });
}
