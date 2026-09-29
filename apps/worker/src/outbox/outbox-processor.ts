import type { OutboxEventRecord, OutboxWorkerConfig } from '@lobby/database';

import {
  createDispatchLog,
  createDispatchLogger,
  permanentFailureMessage,
  type DispatchLogger,
  type PermanentFailureCode,
} from '../dispatch/dispatch-logger.js';
import {
  createWorkerEventRegistry,
  type EventRegistryEntry,
  type WorkerEventRegistry,
} from '../dispatch/event-registry.js';
import { runRegisteredHandlers } from '../dispatch/run-handlers.js';
import { outboxFailureAction } from '../dispatch/retry-classification.js';
import type { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import type { TenantCreatedHandler } from '../handlers/tenant-created.handler.js';
import type { OutboxRepository } from './outbox-repository.js';
import { sanitizeOutboxError } from './sanitize-outbox-error.js';

type ReadEventResult = { ok: true; event: unknown } | { ok: false };

export class OutboxProcessor {
  private readonly registry: WorkerEventRegistry;

  constructor(
    private readonly repository: OutboxRepository,
    contactCreated: ContactCreatedHandler,
    tenantCreated: TenantCreatedHandler,
    private readonly config: OutboxWorkerConfig,
    private readonly now: () => Date = () => new Date(),
    private readonly logger: DispatchLogger = createDispatchLogger(),
  ) {
    this.registry = createWorkerEventRegistry({ contactCreated, tenantCreated });
  }

  async process(record: OutboxEventRecord): Promise<void> {
    const entry = this.registry.get(record.eventType, record.eventVersion);
    if (!entry) {
      await this.failPermanently(record, 'unknown_event');
      return;
    }
    const parsed = await this.readEvent(record, entry);
    if (!parsed.ok) {
      return;
    }
    try {
      await runRegisteredHandlers(entry.handlers, parsed.event);
      await this.repository.markPublished(record.id, this.now());
    } catch (error) {
      await this.recordHandlerFailure(record, error);
    }
  }

  private async readEvent(
    record: OutboxEventRecord,
    entry: EventRegistryEntry,
  ): Promise<ReadEventResult> {
    try {
      return { ok: true, event: entry.schema.parse(toStoredEventEnvelope(record)) };
    } catch {
      await this.failPermanently(record, 'invalid_event');
      return { ok: false };
    }
  }

  private async recordHandlerFailure(record: OutboxEventRecord, error: unknown): Promise<void> {
    if (outboxFailureAction(error) === 'retry') {
      await this.recordFailure(record, error);
      return;
    }
    await this.failPermanently(record, 'permanent_handler_failure', sanitizeOutboxError(error));
  }

  private async failPermanently(
    record: OutboxEventRecord,
    code: PermanentFailureCode,
    storedError = permanentFailureMessage(code, record.eventType, record.eventVersion),
  ): Promise<void> {
    this.logger.error(createDispatchLog(record, code));
    await this.repository.markFailed(record.id, storedError);
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

function toStoredEventEnvelope(record: OutboxEventRecord): unknown {
  return {
    eventId: record.id,
    eventType: record.eventType,
    eventVersion: record.eventVersion,
    tenantId: record.tenantId,
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    occurredAt: record.occurredAt.toISOString(),
    payload: record.payload,
  };
}
