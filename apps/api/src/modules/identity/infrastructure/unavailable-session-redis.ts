import type { SessionRedisClient } from './session-redis';

const SESSION_STORE_UNAVAILABLE = 'Session store is unavailable.';

/** Used when Upstash credentials are not configured. Every command fails closed. */
export class UnavailableSessionRedis implements SessionRedisClient {
  get(): Promise<string | null> {
    return rejectUnavailable();
  }

  set(): Promise<void> {
    return rejectUnavailable();
  }

  del(): Promise<void> {
    return rejectUnavailable();
  }

  sadd(): Promise<void> {
    return rejectUnavailable();
  }

  srem(): Promise<void> {
    return rejectUnavailable();
  }

  smembers(): Promise<readonly string[]> {
    return rejectUnavailable();
  }
}

function rejectUnavailable(): Promise<never> {
  return Promise.reject(new Error(SESSION_STORE_UNAVAILABLE));
}
