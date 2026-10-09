import { SessionStoreUnavailableError } from './session-store-error';
import type { SessionRedisClient } from './session-redis';

/** Used when Upstash credentials are not configured. Every command fails closed. */
export class UnavailableSessionRedis implements SessionRedisClient {
  get(): Promise<string | null> {
    return rejectUnavailable();
  }

  set(): Promise<void> {
    return rejectUnavailable();
  }

  replaceIfPresent(): Promise<boolean> {
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
  return Promise.reject(new SessionStoreUnavailableError());
}
