import type { RateLimitRedis } from './rate-limit-redis';

const RATE_LIMIT_STORE_UNAVAILABLE = 'Rate limit store is unavailable.';

/** Used when Upstash credentials are not configured. Login and registration fail closed. */
export class UnavailableRateLimitRedis implements RateLimitRedis {
  increment(): Promise<number> {
    return rejectUnavailable();
  }

  delete(): Promise<void> {
    return rejectUnavailable();
  }
}

function rejectUnavailable(): Promise<never> {
  return Promise.reject(new Error(RATE_LIMIT_STORE_UNAVAILABLE));
}
