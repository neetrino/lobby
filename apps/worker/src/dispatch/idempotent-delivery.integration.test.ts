import type { PrismaClient } from '@lobby/database';
import { createTestPrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bindIdempotentDelivery } from './idempotent-delivery.js';
import { PrismaProcessedEventStore } from './prisma-processed-event-store.js';
import type { ProcessedEventKey } from './processed-event-store.js';

const identity = { eventType: 'contact.created', eventVersion: 1 };

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await prisma.$executeRaw`DELETE FROM processed_events`;
});

describe('durable idempotent delivery', () => {
  it('does not repeat the side effect when a new process retries after the send', async () => {
    const event = { eventId: crypto.randomUUID() };
    let sends = 0;
    const handler = {
      name: 'Mailer',
      async handle(): Promise<void> {
        sends += 1;
      },
    };

    await bindIdempotentDelivery(handler, new PrismaProcessedEventStore(prisma), identity).run(event);
    await bindIdempotentDelivery(handler, new PrismaProcessedEventStore(prisma), identity).run(event);

    expect(sends).toBe(1);
    const rows = await prisma.$queryRaw<Array<{ event_id: string }>>`
      SELECT event_id FROM processed_events WHERE event_id = CAST(${event.eventId} AS uuid)
    `;
    expect(rows).toHaveLength(1);
  });

  it('keeps the reservation when the handler throws after the side effect', async () => {
    const event = { eventId: crypto.randomUUID() };
    let sends = 0;
    const handler = {
      name: 'Mailer',
      async handle(): Promise<void> {
        sends += 1;
        throw new Error('worker died after the provider accepted the call');
      },
    };
    const first = new PrismaProcessedEventStore(prisma);
    const restarted = new PrismaProcessedEventStore(prisma);

    await expect(bindIdempotentDelivery(handler, first, identity).run(event)).rejects.toThrow(
      'worker died after the provider accepted the call',
    );
    await bindIdempotentDelivery(handler, restarted, identity).run(event);

    expect(sends).toBe(1);
  });

  it('lets only one of two concurrent reservations win', async () => {
    const key: ProcessedEventKey = {
      handlerName: 'Mailer',
      eventType: identity.eventType,
      eventVersion: identity.eventVersion,
      eventId: crypto.randomUUID(),
    };
    const first = new PrismaProcessedEventStore(prisma);
    const second = new PrismaProcessedEventStore(prisma);

    const results = await Promise.all([first.tryReserve(key), second.tryReserve(key)]);

    expect(results.filter((reserved) => reserved)).toHaveLength(1);
  });
});