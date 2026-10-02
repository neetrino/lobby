import { z } from 'zod';

import { MemoryRateLimitRedis } from './memory-rate-limit-redis';
import type { RateLimitRedis } from './rate-limit-redis';
import { UnavailableRateLimitRedis } from './unavailable-rate-limit-redis';
import {
  allowsLocalSessionStore,
  readSessionRedisTimeoutMs,
  readUpstashSessionConfig,
} from './upstash-session-redis';

const RATE_LIMIT_STORE_UNAVAILABLE = 'Rate limit store is unavailable.';

/**
 * Fixed window in one Redis round trip.
 * The TTL is set only on the first increment, so later hits do not extend it.
 */
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`;

const upstashResponseSchema = z.object({
  result: z.unknown().optional(),
  error: z.string().optional(),
});

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<Response>;

/**
 * Rate-limit counters on the shared Upstash deployment.
 * Keys stay in `rate_limit:` and are never session records.
 */
export class UpstashRateLimitRedis implements RateLimitRedis {
  constructor(
    private readonly config: { url: string; token: string },
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs: number = readSessionRedisTimeoutMs(),
  ) {}

  async increment(key: string, windowMs: number): Promise<number> {
    const result = await this.command(['EVAL', INCREMENT_SCRIPT, '1', key, String(windowMs)]);
    return requireCount(result);
  }

  async delete(key: string): Promise<void> {
    await this.command(['DEL', key]);
  }

  private async command(command: readonly string[]): Promise<unknown> {
    try {
      const response = await this.fetchImpl(this.config.url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        throw new Error(RATE_LIMIT_STORE_UNAVAILABLE);
      }
      const parsed = upstashResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.error !== undefined) {
        throw new Error(RATE_LIMIT_STORE_UNAVAILABLE);
      }
      return parsed.data.result ?? null;
    } catch (error) {
      if (error instanceof Error && error.message === RATE_LIMIT_STORE_UNAVAILABLE) {
        throw error;
      }
      throw new Error(RATE_LIMIT_STORE_UNAVAILABLE);
    }
  }
}

export function createRateLimitRedisClient(env: NodeJS.ProcessEnv = process.env): RateLimitRedis {
  const config = readUpstashSessionConfig(env);
  if (config !== null) {
    return new UpstashRateLimitRedis(config, fetch, readSessionRedisTimeoutMs(env));
  }
  if (allowsLocalSessionStore(env)) {
    return new MemoryRateLimitRedis();
  }
  return new UnavailableRateLimitRedis();
}

function requireCount(result: unknown): number {
  const count = typeof result === 'number' ? result : Number(result);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(RATE_LIMIT_STORE_UNAVAILABLE);
  }
  return count;
}
