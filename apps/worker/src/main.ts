import {
  createPrismaClient,
  readDatabaseUrl,
  readInvitationTokenKey,
  readOutboxWorkerConfig,
} from '@lobby/database';

import { createDispatchLogger } from './dispatch/dispatch-logger.js';
import { PrismaProcessedEventStore } from './dispatch/prisma-processed-event-store.js';
import { readEmailProvider } from './email/email-provider.js';
import { ContactCreatedHandler } from './handlers/contact-created.handler.js';
import { MemberInvitationEmailHandler } from './handlers/member-invitation-email.handler.js';
import { TenantCreatedHandler } from './handlers/tenant-created.handler.js';
import { OutboxProcessor } from './outbox/outbox-processor.js';
import { OutboxRelay } from './outbox/outbox-relay.js';
import { OutboxRepository } from './outbox/outbox-repository.js';

export async function startOutboxRelay(signal: AbortSignal): Promise<void> {
  const config = readOutboxWorkerConfig();
  const prisma = createPrismaClient(readDatabaseUrl());
  const repository = new OutboxRepository(prisma, config);
  const processor = new OutboxProcessor(
    repository,
    new ContactCreatedHandler(),
    new TenantCreatedHandler(),
    config,
    () => new Date(),
    createDispatchLogger(),
    {
      handler: new MemberInvitationEmailHandler(
        readEmailProvider(),
        readInvitationTokenKey(),
        process.env.APP_URL?.trim() ?? '',
      ),
      store: new PrismaProcessedEventStore(prisma),
    },
  );
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
