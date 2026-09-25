export const outboxEventStatuses = ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'] as const;

export type OutboxEventStatus = (typeof outboxEventStatuses)[number];

export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date(),
};

export type OutboxEventRecord = {
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
};
