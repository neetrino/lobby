import type { OutboxWorkerConfig, PrismaClient } from '@lobby/database';
import { createTestPrismaClient, disposeTestPrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import { ReservationCreatedHandler } from '../handlers/reservation-created.handler.js';
import { TenantCreatedHandler } from '../handlers/tenant-created.handler.js';
import { OutboxProcessor } from '../outbox/outbox-processor.js';
import { OutboxRepository } from '../outbox/outbox-repository.js';
import {
  createDispatchLogger,
  isPermanentFailureCode,
  type DispatchLog,
} from './dispatch-logger.js';
import { PermanentDispatchError } from './retry-classification.js';

const config: OutboxWorkerConfig = {
  workerId: 'worker-a',
  maxAttempts: 3,
  retryDelayMs: 1_000,
  batchSize: 10,
  pollIntervalMs: 1_000,
  lockTimeoutMs: 60_000,
};

const secretPayload = 'secret-payload-value';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await prisma.outboxEvent.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('dispatch registry failures', () => {
  it('fails an unknown event permanently without calling a handler', async () => {
    const tenant = await createTenant();
    const event = await seedEvent(tenant.id, {
      eventType: 'deal.created',
      eventVersion: 1,
      aggregateType: 'deal',
    });
    const contactHandler = new ContactCreatedHandler();
    const tenantHandler = new TenantCreatedHandler();
    const { processor, logs } = createProcessor(contactHandler, tenantHandler);
    const claimed = await claimOne();

    await processor.process(claimed);

    expect(contactHandler.deliveryCount()).toBe(0);
    expect(tenantHandler.deliveryCount()).toBe(0);
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.status).toBe('FAILED');
    expect(stored.attempts).toBe(1);
    expect(stored.lastError).toBe('Unknown event deal.created@1');
    expect(logs.map(readLog)).toEqual([
      {
        level: 'error',
        message: 'Unknown event deal.created@1',
        eventType: 'deal.created',
        eventVersion: 1,
        eventId: event.id,
        code: 'unknown_event',
      },
    ]);
    expect(logs.join('')).not.toContain(secretPayload);
  });

  it('does not fall back from contact.created@2 to the version 1 handler', async () => {
    const tenant = await createTenant();
    const event = await seedEvent(tenant.id, {
      eventType: 'contact.created',
      eventVersion: 2,
      aggregateType: 'contact',
    });
    const contactHandler = new ContactCreatedHandler();
    const { processor, logs } = createProcessor(contactHandler, new TenantCreatedHandler());
    const claimed = await claimOne();

    await processor.process(claimed);

    expect(contactHandler.deliveryCount()).toBe(0);
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.status).toBe('FAILED');
    expect(stored.lastError).toBe('Unknown event contact.created@2');
    expect(logs.join('')).not.toContain(secretPayload);
  });

  it('publishes reservation.created@1 instead of failing it as unknown', async () => {
    const tenant = await createTenant();
    const reservationId = crypto.randomUUID();
    const event = await prisma.outboxEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'reservation.created',
        eventVersion: 1,
        aggregateType: 'reservation',
        aggregateId: reservationId,
        payload: {
          reservationId,
          locationId: crypto.randomUUID(),
          contactId: null,
          source: 'STAFF',
          status: 'PENDING',
          startsAt: '2026-10-09T18:00:00.000Z',
        },
        occurredAt: new Date('2026-10-09T09:00:00.000Z'),
        availableAt: new Date(0),
      },
    });
    const reservationHandler = new ReservationCreatedHandler();
    const { processor } = createProcessor(new ContactCreatedHandler(), new TenantCreatedHandler(), reservationHandler);
    const claimed = await claimOne();

    await processor.process(claimed);

    expect(reservationHandler.deliveryCount()).toBe(1);
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.status).toBe('PUBLISHED');
    expect(stored.lastError).toBeNull();
  });

  it('marks a permanent handler error as failed before the attempt limit', async () => {
    const tenant = await createTenant();
    const event = await seedEvent(tenant.id, {
      eventType: 'contact.created',
      eventVersion: 1,
      aggregateType: 'contact',
    });
    const contactHandler = new ContactCreatedHandler();
    contactHandler.handle = () =>
      Promise.reject(new PermanentDispatchError('Business rule rejected the event'));
    const { processor, logs } = createProcessor(contactHandler, new TenantCreatedHandler());
    const claimed = await claimOne();

    await processor.process(claimed);

    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.status).toBe('FAILED');
    expect(stored.attempts).toBe(1);
    expect(stored.lastError).toBe('Business rule rejected the event');
    expect(readLog(logs[0] ?? '').code).toBe('permanent_handler_failure');
    expect(logs.join('')).not.toContain(secretPayload);
  });
});

function createProcessor(
  contactHandler: ContactCreatedHandler,
  tenantHandler: TenantCreatedHandler,
  reservationHandler: ReservationCreatedHandler = new ReservationCreatedHandler(),
) {
  const logs: string[] = [];
  const repository = new OutboxRepository(prisma, config);
  const processor = new OutboxProcessor(
    repository,
    contactHandler,
    tenantHandler,
    reservationHandler,
    config,
    () => new Date(),
    createDispatchLogger((line) => {
      logs.push(line);
    }),
  );
  return { processor, logs };
}

async function claimOne() {
  const repository = new OutboxRepository(prisma, config);
  const [claimed] = await repository.claimBatch();
  if (!claimed) {
    throw new Error('expected a claimed event');
  }
  return claimed;
}

async function createTenant() {
  const subdomain = `tenant-${crypto.randomUUID()}`;
  return prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
}

async function seedEvent(
  tenantId: string,
  event: { eventType: string; eventVersion: number; aggregateType: string },
) {
  return prisma.outboxEvent.create({
    data: {
      tenantId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      aggregateType: event.aggregateType,
      aggregateId: crypto.randomUUID(),
      payload: { name: secretPayload },
      occurredAt: new Date('2026-09-25T09:00:00.000Z'),
      availableAt: new Date(0),
    },
  });
}

function readLog(line: string): DispatchLog {
  const value: unknown = JSON.parse(line);
  if (!isDispatchLog(value)) {
    throw new Error('Log line does not match the dispatch log contract');
  }
  return value;
}

function isDispatchLog(value: unknown): value is DispatchLog {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.level === 'error' &&
    typeof value.message === 'string' &&
    typeof value.eventType === 'string' &&
    typeof value.eventVersion === 'number' &&
    typeof value.eventId === 'string' &&
    isPermanentFailureCode(value.code)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
