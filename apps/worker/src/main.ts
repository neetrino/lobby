import { createPrismaClient, readDatabaseUrl, readOutboxWorkerConfig } from '@lobby/database';

import { ContactCreatedHandler } from './handlers/contact-created.handler.js';
import { OutboxProcessor } from './outbox/outbox-processor.js';
import { OutboxRelay } from './outbox/outbox-relay.js';
import { OutboxRepository } from './outbox/outbox-repository.js';

export async function startOutboxRelay(signal: AbortSignal): Promise<void> {
  const config = readOutboxWorkerConfig();
  const prisma = createPrismaClient(readDatabaseUrl());
  const repository = new OutboxRepository(prisma, config);
  const processor = new OutboxProcessor(repository, new ContactCreatedHandler(), config);
  const relay = new OutboxRelay(repository, processor, config);

  try {
    await relay.run(signal);
  } finally {
    await prisma.$disconnect();
  }
}

function listenForShutdown(): AbortSignal {
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  return controller.signal;
}

void startOutboxRelay(listenForShutdown());
