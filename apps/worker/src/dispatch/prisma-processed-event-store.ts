import type { Prisma, PrismaClient } from '@lobby/database';

import type { ProcessedEventKey, ProcessedEventStore } from './processed-event-store.js';

/**
 * Commits one `processed_events` row in its own transaction.
 * `ON CONFLICT DO NOTHING` loses the race without sending the effect twice.
 */
export class PrismaProcessedEventStore implements ProcessedEventStore {
  constructor(private readonly prisma: PrismaClient) {}

  tryReserve(key: ProcessedEventKey): Promise<boolean> {
    return this.prisma.$transaction((tx) => insertReservation(tx, key));
  }
}

async function insertReservation(
  tx: Prisma.TransactionClient,
  key: ProcessedEventKey,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ event_id: string }>>`
    INSERT INTO processed_events (handler_name, event_type, event_version, event_id)
    VALUES (${key.handlerName}, ${key.eventType}, ${key.eventVersion}, CAST(${key.eventId} AS uuid))
    ON CONFLICT (handler_name, event_type, event_version, event_id) DO NOTHING
    RETURNING event_id
  `;
  return rows.length === 1;
}
