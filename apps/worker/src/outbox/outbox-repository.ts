import {
  calculateRetryAt,
  systemClock,
  type Clock,
  type OutboxEventRecord,
  type OutboxEventStatus,
  type OutboxWorkerConfig,
  type Prisma,
  type PrismaClient,
} from '@lobby/database';

type ClaimedRow = {
  id: string;
};

export class OutboxRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: OutboxWorkerConfig,
    private readonly clock: Clock = systemClock,
  ) {}

  claimBatch(): Promise<OutboxEventRecord[]> {
    return this.prisma.$transaction((tx) => this.claimInTransaction(tx));
  }

  async claimInTransaction(tx: Prisma.TransactionClient): Promise<OutboxEventRecord[]> {
    await this.recoverStaleLocks(tx);
    const ids = await this.lockPendingIds(tx);
    if (ids.length === 0) {
      return [];
    }
    const lockedAt = this.clock.now();
    await tx.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        lockedAt,
        lockedBy: this.config.workerId,
      },
    });
    const rows = await tx.outboxEvent.findMany({ where: { id: { in: ids } } });
    return rows.map(toOutboxEventRecord);
  }

  async markPublished(id: string, publishedAt: Date): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt,
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async markRetry(id: string, attempts: number, lastError: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'PENDING',
        availableAt: calculateRetryAt(this.clock.now(), attempts, this.config.retryDelayMs),
        lastError,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async markFailed(id: string, lastError: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        lastError,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  private async recoverStaleLocks(tx: Prisma.TransactionClient): Promise<void> {
    const staleBefore = new Date(this.clock.now().getTime() - this.config.lockTimeoutMs);
    await tx.$executeRaw`
      UPDATE outbox_events
      SET status = 'PENDING',
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW()
      WHERE id IN (
        SELECT id
        FROM outbox_events
        WHERE status = 'PROCESSING'
          AND locked_at IS NOT NULL
          AND locked_at <= ${staleBefore}
        FOR UPDATE SKIP LOCKED
      )
    `;
  }

  private async lockPendingIds(tx: Prisma.TransactionClient): Promise<string[]> {
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      SELECT id
      FROM outbox_events
      WHERE status = 'PENDING'
        AND available_at <= NOW()
      ORDER BY available_at, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${this.config.batchSize}
    `;
    return rows.map((row) => row.id);
  }
}

function toOutboxEventRecord(row: {
  id: string;
  tenantId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  status: OutboxEventStatus;
  occurredAt: Date;
  availableAt: Date;
  attempts: number;
  lockedAt: Date | null;
  lockedBy: string | null;
  publishedAt: Date | null;
  lastError: string | null;
}): OutboxEventRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    eventType: row.eventType,
    eventVersion: row.eventVersion,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    payload: row.payload,
    status: row.status,
    occurredAt: row.occurredAt,
    availableAt: row.availableAt,
    attempts: row.attempts,
    lockedAt: row.lockedAt,
    lockedBy: row.lockedBy,
    publishedAt: row.publishedAt,
    lastError: row.lastError,
  };
}
