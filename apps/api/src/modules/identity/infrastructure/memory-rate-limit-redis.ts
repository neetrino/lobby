import type { RateLimitRedis } from './rate-limit-redis';

type Counter = { count: number; expiresAtMs: number };

/** Process-local counters. Production uses the Upstash client with the same key contract. */
export class MemoryRateLimitRedis implements RateLimitRedis {
  readonly counters = new Map<string, Counter>();
  now = (): number => Date.now();

  increment(key: string, windowMs: number): Promise<number> {
    const current = this.counters.get(key);
    const now = this.now();
    if (current === undefined || current.expiresAtMs <= now) {
      this.counters.set(key, { count: 1, expiresAtMs: now + windowMs });
      return Promise.resolve(1);
    }

    current.count += 1;
    return Promise.resolve(current.count);
  }

  delete(key: string): Promise<void> {
    this.counters.delete(key);
    return Promise.resolve();
  }
}
