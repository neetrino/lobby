/** Nest injection token. This client must not be the session store. */
export const RATE_LIMIT_REDIS = Symbol('RATE_LIMIT_REDIS');

/**
 * Counter commands for the `rate_limit:` key space.
 * `windowMs` is applied only when a key is created, so the window does not slide forward on later hits.
 */
export interface RateLimitRedis {
  increment(key: string, windowMs: number): Promise<number>;
  delete(key: string): Promise<void>;
}
