export type OutboxWorkerConfig = {
  workerId: string;
  maxAttempts: number;
  retryDelayMs: number;
  batchSize: number;
  pollIntervalMs: number;
  lockTimeoutMs: number;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 30_000;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_LOCK_TIMEOUT_MS = 120_000;
const MAX_RETRY_EXPONENT = 5;

export function readOutboxWorkerConfig(env: NodeJS.ProcessEnv = process.env): OutboxWorkerConfig {
  return {
    workerId: readWorkerId(env.OUTBOX_WORKER_ID),
    maxAttempts: readPositiveInt(env.OUTBOX_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
    retryDelayMs: readPositiveInt(env.OUTBOX_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS),
    batchSize: readPositiveInt(env.OUTBOX_BATCH_SIZE, DEFAULT_BATCH_SIZE),
    pollIntervalMs: readPositiveInt(env.OUTBOX_POLL_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS),
    lockTimeoutMs: readPositiveInt(env.OUTBOX_LOCK_TIMEOUT_MS, DEFAULT_LOCK_TIMEOUT_MS),
  };
}

/** Next attempt time. Delay doubles per attempt and is capped at 32 times the base delay. */
export function calculateRetryAt(now: Date, attempts: number, retryDelayMs: number): Date {
  const exponent = Math.min(Math.max(attempts - 1, 0), MAX_RETRY_EXPONENT);
  return new Date(now.getTime() + retryDelayMs * 2 ** exponent);
}

function readWorkerId(value: string | undefined): string {
  const workerId = value?.trim();
  return workerId ? workerId : `worker-${process.pid}`;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer configuration value, received "${value}"`);
  }
  return parsed;
}
