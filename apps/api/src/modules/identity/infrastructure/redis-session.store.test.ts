import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { SESSION_IDLE_TTL_MS, SESSION_REFRESH_INTERVAL_MS } from '../domain/session-policy';
import { RedisSessionStore, StaleSessionError } from './redis-session.store';
import { createRawSessionId, hashSessionId, sessionKey, userSessionsKey } from './session-id';
import type { SessionRedisClient } from './session-redis';

const userId = '11111111-1111-4111-8111-111111111111';
const tenantId = '22222222-2222-4222-8222-222222222222';
const otherUserId = '33333333-3333-4333-8333-333333333333';
const now = new Date('2026-09-28T10:00:00.000Z');
const subject = { userId, tenantId, role: 'OWNER' as const, authenticationVersion: 1 };

describe('RedisSessionStore', () => {
  it('returns the created session and stores a hash key with a matching ttl', async () => {
    const redis = new MemorySessionRedis();
    const store = new RedisSessionStore(redis);
    const created = await store.create(subject, now);
    const loaded = await store.get(created.rawSessionId, now);
    const key = sessionKey(created.session.sessionIdHash);
    const stored = redis.strings.get(key);
    const expectedHash = createHash('sha256').update(created.rawSessionId, 'utf8').digest('hex');

    expect(loaded).toEqual(created.session);
    expect(created.session.sessionIdHash).toBe(expectedHash);
    expect(stored?.expiresAtMs).toBe(created.session.idleExpiresAt.getTime());
    expect(redis.sets.get(userSessionsKey(userId))?.expiresAtMs).toBe(created.session.absoluteExpiresAt.getTime());
    expect(redis.sets.get(userSessionsKey(userId))?.members.has(expectedHash)).toBe(true);
    expect([...redis.strings.keys()].some((redisKey) => redisKey.includes(created.rawSessionId))).toBe(false);
    expect(stored?.value.includes(created.rawSessionId)).toBe(false);
  });

  it('treats a malformed payload as a missing session', async () => {
    const redis = new MemorySessionRedis();
    const store = new RedisSessionStore(redis);
    const rawSessionId = createRawSessionId();
    const sessionIdHash = hashSessionId(rawSessionId);
    const key = sessionKey(sessionIdHash);

    await redis.set(key, JSON.stringify({ userId, role: 'SUPERUSER' }), now.getTime() + SESSION_IDLE_TTL_MS);
    await redis.sadd(userSessionsKey(userId), sessionIdHash, now.getTime() + SESSION_IDLE_TTL_MS);

    await expect(store.get(rawSessionId, now)).resolves.toBeNull();
    await expect(redis.get(key)).resolves.toBeNull();
    await expect(redis.smembers(userSessionsKey(userId))).resolves.toEqual([]);
    await expect(store.get('not-a-session-id', now)).resolves.toBeNull();
  });

  it('does not slide the absolute deadline when the idle window is refreshed', async () => {
    const redis = new MemorySessionRedis();
    const store = new RedisSessionStore(redis);
    const created = await store.create(subject, now);
    let current = created.session;

    for (let step = 0; step < 4; step += 1) {
      const touchAt = new Date(current.idleExpiresAt.getTime() - 1);
      const touched = await store.touch(created.rawSessionId, touchAt);

      expect(touched?.absoluteExpiresAt).toEqual(created.session.absoluteExpiresAt);
      if (touched === null) {
        throw new Error('Session expired before the absolute deadline.');
      }
      current = touched;
    }

    expect(current.idleExpiresAt).toEqual(created.session.absoluteExpiresAt);
    expect(redis.strings.get(sessionKey(created.session.sessionIdHash))?.expiresAtMs).toBe(
      created.session.absoluteExpiresAt.getTime(),
    );
  });

  it('does not write before the refresh interval', async () => {
    const redis = new MemorySessionRedis();
    const store = new RedisSessionStore(redis);
    const created = await store.create(subject, now);
    const writesAfterCreate = redis.setCalls;
    const early = new Date(now.getTime() + SESSION_REFRESH_INTERVAL_MS - 1);
    const touched = await store.touch(created.rawSessionId, early);

    expect(redis.setCalls).toBe(writesAfterCreate);
    expect(touched?.lastSeenAt).toEqual(created.session.lastSeenAt);
    expect(touched?.idleExpiresAt).toEqual(created.session.idleExpiresAt);
    expect(touched?.absoluteExpiresAt).toEqual(created.session.absoluteExpiresAt);
  });

  it('deletes every session key and the reverse index for a user', async () => {
    const redis = new MemorySessionRedis();
    const store = new RedisSessionStore(redis);
    const first = await store.create(subject, now);
    const second = await store.create(subject, now);
    const other = await store.create({ ...subject, userId: otherUserId }, now);

    await store.deleteAllForUser(userId);

    await expect(redis.get(sessionKey(first.session.sessionIdHash))).resolves.toBeNull();
    await expect(redis.get(sessionKey(second.session.sessionIdHash))).resolves.toBeNull();
    await expect(redis.smembers(userSessionsKey(userId))).resolves.toEqual([]);
    expect(redis.sets.has(userSessionsKey(userId))).toBe(false);
    await expect(redis.get(sessionKey(other.session.sessionIdHash))).resolves.not.toBeNull();
    expect(redis.sets.get(userSessionsKey(otherUserId))?.members.has(other.session.sessionIdHash)).toBe(true);
  });

  it('drops a session when the user version changed before the write was confirmed', async () => {
    const redis = new MemorySessionRedis();
    const store = new RedisSessionStore(redis, {
      findSecurity: () => Promise.resolve({ status: 'ACTIVE', authenticationVersion: 2 }),
    });

    await expect(store.create(subject, now)).rejects.toBeInstanceOf(StaleSessionError);
    expect(redis.strings.size).toBe(0);
    await expect(redis.smembers(userSessionsKey(userId))).resolves.toEqual([]);
  });

  it('keeps a session when the stored authentication version still matches', async () => {
    const redis = new MemorySessionRedis();
    const store = new RedisSessionStore(redis, {
      findSecurity: () => Promise.resolve({ status: 'ACTIVE', authenticationVersion: 1 }),
    });

    const created = await store.create(subject, now);

    await expect(store.get(created.rawSessionId, now)).resolves.toEqual(created.session);
  });
});

class MemorySessionRedis implements SessionRedisClient {
  readonly strings = new Map<string, { value: string; expiresAtMs: number }>();
  readonly sets = new Map<string, { members: Set<string>; expiresAtMs: number }>();
  setCalls = 0;

  async get(key: string): Promise<string | null> {
    return this.strings.get(key)?.value ?? null;
  }

  async set(key: string, value: string, expiresAtMs: number): Promise<void> {
    this.setCalls += 1;
    this.strings.set(key, { value, expiresAtMs });
  }

  async del(key: string): Promise<void> {
    this.strings.delete(key);
    this.sets.delete(key);
  }

  async sadd(key: string, member: string, expiresAtMs: number): Promise<void> {
    const current = this.sets.get(key);
    const members = current?.members ?? new Set<string>();
    members.add(member);
    const nextExpiry = current === undefined ? expiresAtMs : Math.max(current.expiresAtMs, expiresAtMs);
    this.sets.set(key, { members, expiresAtMs: nextExpiry });
  }

  async srem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.members.delete(member);
  }

  async smembers(key: string): Promise<readonly string[]> {
    return [...(this.sets.get(key)?.members ?? [])];
  }
}
