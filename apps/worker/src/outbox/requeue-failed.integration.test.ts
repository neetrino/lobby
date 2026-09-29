import type { OutboxWorkerConfig, PrismaClient } from '@lobby/database';
import { createTestPrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import { TenantCreatedHandler } from '../handlers/tenant-created.handler.js';
import { PermanentDispatchError } from '../dispatch/retry-classification.js';
import { OutboxProcessor } from './outbox-processor.js';
import { OutboxRelay } from './outbox-relay.js';
import { OutboxRepository } from './outbox-repository.js';

const config: OutboxWorkerConfig = {
  workerId: 'worker-a',
  maxAttempts: 3,
  retryDelayMs: 1_000,
  batchSize: 10,
  pollIntervalMs: 1_000,
  lockTimeoutMs: 60_000,
};

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await prisma.outboxEvent.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('manual failed-event requeue', () => {
  it('processes a requeued event on the next poll and resets attempts', async () => {
    const tenant = await createTenant();
    const event = await seedEvent(tenant.id, 'contact.created', 1);
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { attempts: config.maxAttempts } });
    const contactHandler = new ContactCreatedHandler();
    let fail = true;
    contactHandler.handle = () => {
      if (fail) {
        return Promise.reject(new PermanentDispatchError('deployment mismatch'));
      }
      return Promise.resolve();
    };
    const repository = new OutboxRepository(prisma, config);
    const relay = new OutboxRelay(repository, createProcessor(repository, contactHandler), config);

    await relay.pollOnce();
    const failed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(failed.status).toBe('FAILED');

    fail = false;
    expect(await repository.requeueFailedById(event.id)).toBe(1);
    const requeued = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(requeued.status).toBe('PENDING');
    expect(requeued.attempts).toBe(0);
    expect(requeued.lastError).toBeNull();
    expect(requeued.lockedBy).toBeNull();

    await relay.pollOnce();
    const published = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(published.status).toBe('PUBLISHED');
    expect(published.attempts).toBe(1);
  });

  it('requeues only the requested eventType@eventVersion group', async () => {
    const tenant = await createTenant();
    const first = await seedEvent(tenant.id, 'contact.created', 1);
    const second = await seedEvent(tenant.id, 'contact.created', 1);
    const other = await seedEvent(tenant.id, 'tenant.created', 2);
    await markFailed(first.id, second.id, other.id);
    const repository = new OutboxRepository(prisma, config);

    expect(await repository.requeueFailedByEvent('contact.created', 1)).toBe(2);

    const rows = await prisma.outboxEvent.findMany({ orderBy: { createdAt: 'asc' } });
    const byId = new Map(rows.map((row) => [row.id, row.status]));
    expect(byId.get(first.id)).toBe('PENDING');
    expect(byId.get(second.id)).toBe('PENDING');
    expect(byId.get(other.id)).toBe('FAILED');
    expect(rows.find((row) => row.id === first.id)?.attempts).toBe(0);
  });

  it('does not move a published event back to pending', async () => {
    const tenant = await createTenant();
    const event = await seedEvent(tenant.id, 'contact.created', 1);
    const repository = new OutboxRepository(prisma, config);
    const relay = new OutboxRelay(
      repository,
      createProcessor(repository, new ContactCreatedHandler()),
      config,
    );

    await relay.pollOnce();
    expect(await repository.requeueFailedById(event.id)).toBe(0);
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.status).toBe('PUBLISHED');
  });
});

function createProcessor(repository: OutboxRepository, contactHandler: ContactCreatedHandler): OutboxProcessor {
  return new OutboxProcessor(repository, contactHandler, new TenantCreatedHandler(), config);
}

async function createTenant() {
  const subdomain = `tenant-${crypto.randomUUID()}`;
  return prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
}

async function seedEvent(tenantId: string, eventType: string, eventVersion: number) {
  return prisma.outboxEvent.create({
    data: {
      tenantId,
      eventType,
      eventVersion,
      aggregateType: eventType.split('.')[0] ?? 'contact',
      aggregateId: crypto.randomUUID(),
      payload: eventVersion === 2
        ? {
            name: 'Ada',
            subdomain: 'ada',
            plan: 'starter',
            ownerUserId: crypto.randomUUID(),
          }
        : { name: 'Ada' },
      occurredAt: new Date('2026-09-25T09:00:00.000Z'),
      availableAt: new Date(0),
    },
  });
}

async function markFailed(...ids: string[]): Promise<void> {
  await prisma.outboxEvent.updateMany({
    where: { id: { in: ids } },
    data: { status: 'FAILED', attempts: 4, lastError: 'Unknown event', lockedAt: null, lockedBy: null },
  });
}
