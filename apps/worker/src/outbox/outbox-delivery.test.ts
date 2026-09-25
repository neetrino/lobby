import type { OutboxWorkerConfig, PrismaClient } from '@lobby/database';
import { createTestPrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ContactCreatedHandler } from '../handlers/contact-created.handler.js';
import { TenantCreatedHandler } from '../handlers/tenant-created.handler.js';
import { OutboxProcessor } from './outbox-processor.js';
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

describe('outbox delivery', () => {
  it('prevents two workers from claiming the same event', async () => {
    const tenant = await createTenant();
    await seedEvent(tenant.id);
    const first = new OutboxRepository(prisma, { ...config, workerId: 'worker-a' });
    const second = new OutboxRepository(prisma, { ...config, workerId: 'worker-b' });
    let release: () => void = () => undefined;
    const holding = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked: () => void = () => undefined;
    const hasLock = new Promise<void>((resolve) => {
      locked = resolve;
    });

    const firstClaim = prisma.$transaction(async (tx) => {
      const claimed = await first.claimInTransaction(tx);
      locked();
      await holding;
      return claimed;
    });
    await hasLock;
    const secondClaim = await second.claimBatch();
    release();
    const firstRows = await firstClaim;

    expect(firstRows).toHaveLength(1);
    expect(secondClaim).toHaveLength(0);
  });

  it('publishes a successfully delivered event', async () => {
    const tenant = await createTenant();
    await seedEvent(tenant.id);
    const repository = new OutboxRepository(prisma, config);
    const processor = createProcessor(repository, new ContactCreatedHandler());
    const [claimed] = await repository.claimBatch();
    if (!claimed) {
      throw new Error('expected a claimed event');
    }

    await processor.process(claimed);

    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(stored.status).toBe('PUBLISHED');
    expect(stored.publishedAt).not.toBeNull();
    expect(stored.lockedAt).toBeNull();
    expect(stored.lockedBy).toBeNull();
  });

  it('retries a failed event and fails it after the attempt limit', async () => {
    const tenant = await createTenant();
    await seedEvent(tenant.id);
    const repository = new OutboxRepository(prisma, config);
    const processor = createProcessor(repository, failingHandler());
    const [claimed] = await repository.claimBatch();
    if (!claimed) {
      throw new Error('expected a claimed event');
    }

    await processor.process(claimed);
    const retried = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(retried.status).toBe('PENDING');
    expect(retried.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(retried.lockedBy).toBeNull();
    expect(retried.lastError).toContain('delivery failed');

    await prisma.outboxEvent.update({
      where: { id: claimed.id },
      data: { attempts: config.maxAttempts, availableAt: new Date(0), status: 'PENDING' },
    });
    const [exhausted] = await repository.claimBatch();
    if (!exhausted) {
      throw new Error('expected the retried event');
    }
    await processor.process(exhausted);
    const failed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(failed.status).toBe('FAILED');
  });

  it('recovers a stale processing lock', async () => {
    const tenant = await createTenant();
    const event = await seedEvent(tenant.id);
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(Date.now() - config.lockTimeoutMs - 1_000),
        lockedBy: 'stale-worker',
        attempts: 1,
      },
    });
    const repository = new OutboxRepository(prisma, config);

    const [claimed] = await repository.claimBatch();

    expect(claimed?.id).toBe(event.id);
    expect(claimed?.status).toBe('PROCESSING');
    expect(claimed?.lockedBy).toBe(config.workerId);
    expect(claimed?.attempts).toBe(2);
  });

  it('rejects an invalid stored payload before calling the handler', async () => {
    const tenant = await createTenant();
    const event = await seedEvent(tenant.id, { name: '' });
    const repository = new OutboxRepository(prisma, config);
    const handler = new ContactCreatedHandler();
    const processor = createProcessor(repository, handler);
    const [claimed] = await repository.claimBatch();
    if (!claimed) {
      throw new Error('expected a claimed event');
    }

    await processor.process(claimed);

    expect(handler.deliveryCount()).toBe(0);
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.status).toBe('PENDING');
    expect(stored.lastError).not.toBeNull();
  });

  it('publishes a tenant-created event', async () => {
    const tenant = await createTenant();
    const userId = crypto.randomUUID();
    await prisma.outboxEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'tenant.created',
        eventVersion: 2,
        aggregateType: 'tenant',
        aggregateId: tenant.id,
        payload: {
          name: tenant.name,
          subdomain: tenant.subdomain,
          plan: 'starter',
          ownerUserId: userId,
        },
        occurredAt: new Date('2026-09-25T09:00:00.000Z'),
        availableAt: new Date(0),
      },
    });
    const repository = new OutboxRepository(prisma, config);
    const tenantHandler = new TenantCreatedHandler();
    const processor = new OutboxProcessor(repository, new ContactCreatedHandler(), tenantHandler, config);
    const [claimed] = await repository.claimBatch();
    if (!claimed) {
      throw new Error('expected a claimed event');
    }

    await processor.process(claimed);

    expect(tenantHandler.deliveryCount()).toBe(1);
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(stored.status).toBe('PUBLISHED');
  });

  it('publishes a version 1 tenant-created event', async () => {
    const tenant = await createTenant();
    await prisma.outboxEvent.create({
      data: {
        tenantId: tenant.id,
        eventType: 'tenant.created',
        eventVersion: 1,
        aggregateType: 'tenant',
        aggregateId: tenant.id,
        payload: {
          name: tenant.name,
          subdomain: tenant.subdomain,
          plan: 'starter',
          userId: crypto.randomUUID(),
        },
        occurredAt: new Date('2026-09-25T09:00:00.000Z'),
        availableAt: new Date(0),
      },
    });
    const repository = new OutboxRepository(prisma, config);
    const tenantHandler = new TenantCreatedHandler();
    const processor = new OutboxProcessor(repository, new ContactCreatedHandler(), tenantHandler, config);
    const [claimed] = await repository.claimBatch();
    if (!claimed) {
      throw new Error('expected a claimed event');
    }

    await processor.process(claimed);

    expect(tenantHandler.deliveryCount()).toBe(1);
    const stored = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: claimed.id } });
    expect(stored.status).toBe('PUBLISHED');
  });

  it('tolerates at-least-once handler delivery', async () => {
    const handler = new ContactCreatedHandler();
    const event = {
      eventId: '11111111-1111-4111-8111-111111111111',
      eventType: 'contact.created' as const,
      eventVersion: 1,
      tenantId: '22222222-2222-4222-8222-222222222222',
      aggregateType: 'contact' as const,
      aggregateId: '33333333-3333-4333-8333-333333333333',
      occurredAt: '2026-09-25T09:00:00.000Z',
      payload: { name: 'Ada' },
    };

    await handler.handle(event);
    await handler.handle(event);

    expect(handler.deliveryCount()).toBe(1);
  });
});

function createProcessor(repository: OutboxRepository, contactHandler: ContactCreatedHandler) {
  return new OutboxProcessor(repository, contactHandler, new TenantCreatedHandler(), config);
}

function failingHandler(): ContactCreatedHandler {
  const handler = new ContactCreatedHandler();
  handler.handle = () => Promise.reject(new Error('delivery failed'));
  return handler;
}

async function createTenant() {
  const subdomain = `tenant-${crypto.randomUUID()}`;
  return prisma.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
}

async function seedEvent(tenantId: string, payload: { name: string } = { name: 'Ada' }) {
  return prisma.outboxEvent.create({
    data: {
      tenantId,
      eventType: 'contact.created',
      eventVersion: 1,
      aggregateType: 'contact',
      aggregateId: crypto.randomUUID(),
      payload,
      occurredAt: new Date('2026-09-25T09:00:00.000Z'),
      availableAt: new Date(0),
    },
  });
}
