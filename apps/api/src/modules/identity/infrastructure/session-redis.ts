/** Nest injection token for {@link SessionRedisClient}. */
export const SESSION_REDIS = Symbol('SESSION_REDIS');

/**
 * Redis commands the session store needs.
 * `expiresAtMs` is an absolute epoch-millisecond deadline.
 * Callers must not persist a string key without that deadline.
 * A set deadline may move later, never earlier.
 */
export interface SessionRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiresAtMs: number): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string, expiresAtMs: number): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<readonly string[]>;
}
