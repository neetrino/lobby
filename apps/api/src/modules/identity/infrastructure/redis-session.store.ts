import { Inject, Injectable } from '@nestjs/common';

import type { AuthenticatedSession } from '../domain/authenticated-session';
import { createSessionLifetime, nextIdleExpiresAt, shouldRefresh, isExpired } from '../domain/session-policy';
import { createRawSessionId, hashSessionId, isRawSessionId, sessionKey, userSessionsKey } from './session-id';
import { parseCreateSessionInput, parseStoredSession, readStoredUserId, serializeStoredSession } from './session-record';
import { SESSION_REDIS, type SessionRedisClient } from './session-redis';

export type { CreateSessionInput } from './session-record';

@Injectable()
export class RedisSessionStore {
  constructor(@Inject(SESSION_REDIS) private readonly redis: SessionRedisClient) {}

  /** Confirms the client answers before a tenant is committed. */
  async ping(): Promise<void> {
    await this.redis.get('session:health');
  }

  async create(input: unknown, now: Date): Promise<{ rawSessionId: string; session: AuthenticatedSession }> {
    const subject = parseCreateSessionInput(input);
    const rawSessionId = createRawSessionId();
    const lifetime = createSessionLifetime(now);
    const session: AuthenticatedSession = {
      sessionIdHash: hashSessionId(rawSessionId),
      userId: subject.userId,
      tenantId: subject.tenantId,
      role: subject.role,
      authenticationVersion: subject.authenticationVersion,
      ...lifetime,
    };

    await this.save(session);
    return { rawSessionId, session };
  }

  get(rawSessionId: string, now: Date): Promise<AuthenticatedSession | null> {
    return this.read(rawSessionId, now);
  }

  async touch(rawSessionId: string, now: Date): Promise<AuthenticatedSession | null> {
    const session = await this.read(rawSessionId, now);
    if (session === null || !shouldRefresh(session, now)) {
      return session;
    }

    const refreshed: AuthenticatedSession = {
      ...session,
      lastSeenAt: now,
      idleExpiresAt: nextIdleExpiresAt(now, session.absoluteExpiresAt),
    };
    await this.save(refreshed);
    return refreshed;
  }

  async delete(sessionIdHash: string): Promise<void> {
    const key = sessionKey(sessionIdHash);
    const payload = await this.redis.get(key);
    if (payload !== null) {
      await this.removeIndex(payload, sessionIdHash);
    }
    await this.redis.del(key);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const indexKey = userSessionsKey(userId);
    const hashes = await this.redis.smembers(indexKey);
    for (const sessionIdHash of hashes) {
      await this.redis.del(sessionKey(sessionIdHash));
    }
    await this.redis.del(indexKey);
  }

  private async read(rawSessionId: string, now: Date): Promise<AuthenticatedSession | null> {
    if (!isRawSessionId(rawSessionId)) {
      return null;
    }

    const sessionIdHash = hashSessionId(rawSessionId);
    const key = sessionKey(sessionIdHash);
    const payload = await this.redis.get(key);
    if (payload === null) {
      return null;
    }

    const session = parseStoredSession(payload, sessionIdHash);
    if (session === null) {
      await this.removeIndex(payload, sessionIdHash);
      await this.redis.del(key);
      return null;
    }

    if (isExpired(session, now)) {
      await this.delete(sessionIdHash);
      return null;
    }

    return session;
  }

  private async save(session: AuthenticatedSession): Promise<void> {
    await this.redis.set(
      sessionKey(session.sessionIdHash),
      serializeStoredSession(session),
      session.idleExpiresAt.getTime(),
    );
    await this.redis.sadd(
      userSessionsKey(session.userId),
      session.sessionIdHash,
      session.absoluteExpiresAt.getTime(),
    );
  }

  private async removeIndex(payload: string, sessionIdHash: string): Promise<void> {
    const userId = readStoredUserId(payload);
    if (userId === null) {
      return;
    }

    await this.redis.srem(userSessionsKey(userId), sessionIdHash);
  }
}
