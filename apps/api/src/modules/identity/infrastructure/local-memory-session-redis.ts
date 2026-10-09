import type { SessionRedisClient } from './session-redis';

type ExpiringValue = { value: string; expiresAtMs: number };
type ExpiringSet = { members: Set<string>; expiresAtMs: number };

/**
 * Process-local session store for a machine without Upstash.
 * Production never uses this. A restart drops every session.
 */
export class LocalMemorySessionRedis implements SessionRedisClient {
  private readonly strings = new Map<string, ExpiringValue>();
  private readonly sets = new Map<string, ExpiringSet>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.liveString(key)?.value ?? null);
  }

  set(key: string, value: string, expiresAtMs: number): Promise<void> {
    this.strings.set(key, { value, expiresAtMs });
    return Promise.resolve();
  }

  replaceIfPresent(key: string, value: string, expiresAtMs: number): Promise<boolean> {
    if (this.liveString(key) === undefined) {
      return Promise.resolve(false);
    }
    return this.set(key, value, expiresAtMs).then(() => true);
  }

  del(key: string): Promise<void> {
    this.strings.delete(key);
    this.sets.delete(key);
    return Promise.resolve();
  }

  sadd(key: string, member: string, expiresAtMs: number): Promise<void> {
    const current = this.liveSet(key);
    const members = current?.members ?? new Set<string>();
    members.add(member);
    const nextExpiry =
      current === undefined ? expiresAtMs : Math.max(current.expiresAtMs, expiresAtMs);
    this.sets.set(key, { members, expiresAtMs: nextExpiry });
    return Promise.resolve();
  }

  srem(key: string, member: string): Promise<void> {
    this.liveSet(key)?.members.delete(member);
    return Promise.resolve();
  }

  smembers(key: string): Promise<readonly string[]> {
    return Promise.resolve([...(this.liveSet(key)?.members ?? [])]);
  }

  private liveString(key: string): ExpiringValue | undefined {
    return live(this.strings, key);
  }

  private liveSet(key: string): ExpiringSet | undefined {
    return live(this.sets, key);
  }
}

function live<T extends { expiresAtMs: number }>(rows: Map<string, T>, key: string): T | undefined {
  const row = rows.get(key);
  if (row === undefined) {
    return undefined;
  }
  if (row.expiresAtMs <= Date.now()) {
    rows.delete(key);
    return undefined;
  }
  return row;
}
