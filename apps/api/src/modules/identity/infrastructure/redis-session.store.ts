import { Inject, Injectable } from '@nestjs/common';

import type { StoredSession } from '../domain/authenticated-session';
import {
  createSessionLifetime,
  nextIdleExpiresAt,
  shouldRefresh,
  isExpired,
} from '../domain/session-policy';
import { type SessionVersionReader } from './prisma-session-user';
import {
  createRawSessionId,
  hashSessionId,
  isRawSessionId,
  sessionKey,
  userSessionsKey,
} from './session-id';
import {
  parseCreateSessionInput,
  parseStoredSession,
  readStoredUserId,
  serializeStoredSession,
} from './session-record';
import { SESSION_REDIS, type SessionRedisClient } from './session-redis';

export type { CreateSessionInput } from './session-record';

/** Raised when a session was stored and then removed because its version is no longer current. */
export class StaleSessionError extends Error {
  constructor() {
    super('Session authentication version is no longer current.');
    this.name = 'StaleSessionError';
  }
}

export type SessionTouch =
  { status: 'absent' } | { status: 'present'; session: StoredSession; refreshed: boolean };

export type SessionInspection =
  | { status: 'invalid' }
  | { status: 'missing' }
  | { status: 'malformed' }
  | { status: 'expired' }
  | { status: 'active'; session: StoredSession };

@Injectable()
export class RedisSessionStore {
  constructor(
    @Inject(SESSION_REDIS) private readonly redis: SessionRedisClient,
    private readonly versions?: SessionVersionReader,
  ) {}

  /** Confirms the client answers before a tenant is committed. */
  async ping(): Promise<void> {
    await this.redis.get('session:health');
  }

  async create(
    input: unknown,
    now: Date,
  ): Promise<{ rawSessionId: string; session: StoredSession }> {
    const subject = parseCreateSessionInput(input);
    const rawSessionId = createRawSessionId();
    const lifetime = createSessionLifetime(now);
    const session: StoredSession = {
      sessionIdHash: hashSessionId(rawSessionId),
      userId: subject.userId,
      tenantId: subject.tenantId,
      role: subject.role,
      authenticationVersion: subject.authenticationVersion,
      ...lifetime,
    };

    if (!(await this.saveCurrent(session))) {
      throw new StaleSessionError();
    }
    return { rawSessionId, session };
  }

  /**
   * Deletes one session key, then removes its hash from the user's reverse index.
   * A missing or malformed id is a no-op so logout can be repeated safely.
   */
  async revoke(rawSessionId: string): Promise<void> {
    if (!isRawSessionId(rawSessionId)) {
      return;
    }

    await this.delete(hashSessionId(rawSessionId));
  }

  async get(rawSessionId: string, now: Date): Promise<StoredSession | null> {
    const inspected = await this.inspect(rawSessionId, now);
    return inspected.status === 'active' ? inspected.session : null;
  }

  /**
   * Distinguishes a bad cookie, a missing record, a corrupt payload, and expiry.
   * Expired and corrupt records are deleted.
   */
  inspect(rawSessionId: string, now: Date): Promise<SessionInspection> {
    return this.read(rawSessionId, now);
  }

  async touch(rawSessionId: string, now: Date): Promise<SessionTouch> {
    const inspected = await this.inspect(rawSessionId, now);
    if (inspected.status !== 'active') {
      return { status: 'absent' };
    }
    if (!shouldRefresh(inspected.session, now)) {
      return { status: 'present', session: inspected.session, refreshed: false };
    }

    return this.refresh(inspected.session, now);
  }

  async delete(sessionIdHash: string): Promise<void> {
    const key = sessionKey(sessionIdHash);
    const payload = await this.redis.get(key);
    await this.redis.del(key);
    if (payload !== null) {
      await this.removeIndex(payload, sessionIdHash);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    const indexKey = userSessionsKey(userId);
    const hashes = await this.redis.smembers(indexKey);
    for (const sessionIdHash of hashes) {
      await this.redis.del(sessionKey(sessionIdHash));
    }
    await this.redis.del(indexKey);
  }

  private async read(rawSessionId: string, now: Date): Promise<SessionInspection> {
    if (!isRawSessionId(rawSessionId)) {
      return { status: 'invalid' };
    }

    const sessionIdHash = hashSessionId(rawSessionId);
    const key = sessionKey(sessionIdHash);
    const payload = await this.redis.get(key);
    if (payload === null) {
      return { status: 'missing' };
    }

    const session = parseStoredSession(payload, sessionIdHash);
    if (session === null) {
      await this.removeIndex(payload, sessionIdHash);
      await this.redis.del(key);
      return { status: 'malformed' };
    }

    if (isExpired(session, now)) {
      await this.delete(sessionIdHash);
      return { status: 'expired' };
    }

    return { status: 'active', session };
  }

  /**
   * Slides idle expiry only while the session key still exists.
   * Logout can delete the key after the read; `SET XX` then leaves it deleted.
   */
  private async refresh(session: StoredSession, now: Date): Promise<SessionTouch> {
    const refreshed: StoredSession = {
      ...session,
      lastSeenAt: now,
      idleExpiresAt: nextIdleExpiresAt(now, session.absoluteExpiresAt),
    };
    const replaced = await this.redis.replaceIfPresent(
      sessionKey(session.sessionIdHash),
      serializeStoredSession(refreshed),
      refreshed.idleExpiresAt.getTime(),
    );
    if (!replaced) {
      return { status: 'absent' };
    }

    await this.redis.sadd(
      userSessionsKey(session.userId),
      session.sessionIdHash,
      session.absoluteExpiresAt.getTime(),
    );
    const kept = await this.keepCurrent(refreshed);
    if (kept === null) {
      return { status: 'absent' };
    }
    return { status: 'present', session: kept, refreshed: true };
  }

  private async saveCurrent(session: StoredSession): Promise<boolean> {
    await this.save(session);
    return this.saveCurrentVersion(session);
  }

  private async keepCurrent(session: StoredSession): Promise<StoredSession | null> {
    const kept = await this.saveCurrentVersion(session);
    return kept ? session : null;
  }

  private async saveCurrentVersion(session: StoredSession): Promise<boolean> {
    try {
      await this.discardIfSuperseded(session);
      return true;
    } catch (error) {
      if (error instanceof StaleSessionError) {
        return false;
      }
      throw error;
    }
  }

  private async save(session: StoredSession): Promise<void> {
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

  /**
   * Drops a session written with a version that termination already replaced.
   * The user row is read after the Redis write, so a terminate that committed first cannot leave a usable old session.
   */
  private async discardIfSuperseded(session: StoredSession): Promise<void> {
    if (this.versions === undefined) {
      return;
    }

    const current = await this.versions.findSecurity(session.userId, session.tenantId);
    const versionMatches =
      current !== null &&
      current.status === 'ACTIVE' &&
      current.authenticationVersion === session.authenticationVersion;
    const stored = await this.redis.get(sessionKey(session.sessionIdHash));
    if (versionMatches && stored !== null) {
      return;
    }

    await this.delete(session.sessionIdHash);
    throw new StaleSessionError();
  }

  private async removeIndex(payload: string, sessionIdHash: string): Promise<void> {
    const userId = readStoredUserId(payload);
    if (userId === null) {
      return;
    }

    await this.redis.srem(userSessionsKey(userId), sessionIdHash);
  }
}
