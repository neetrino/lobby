import { pathToFileURL } from 'node:url';

import { createPrismaClient, readDatabaseUrl, readOutboxWorkerConfig } from '@lobby/database';

import { OutboxRepository } from './outbox-repository.js';
import { parseRequeueArgs, type RequeueCommand } from './requeue-command.js';

/**
 * Manual operator entry point. The outbox poll loop does not call this.
 * Exit code 0 when at least one FAILED row was returned to PENDING.
 */
export async function runRequeueCli(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const command = parseRequeueArgs(argv);
  const prisma = createPrismaClient(readDatabaseUrl(env));
  try {
    const matched = await requeueCommand(new OutboxRepository(prisma, readOutboxWorkerConfig(env)), command);
    process.stdout.write(`Requeued ${matched} failed outbox event(s).\n`);
    return matched === 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function requeueCommand(repository: OutboxRepository, command: RequeueCommand): Promise<number> {
  if (command.kind === 'id') {
    return repository.requeueFailedById(command.id);
  }
  return repository.requeueFailedByEvent(command.eventType, command.eventVersion);
}

function isCliEntry(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isCliEntry()) {
  runRequeueCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Requeue failed';
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    },
  );
}
