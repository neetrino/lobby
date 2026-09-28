import { Injectable } from '@nestjs/common';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { sessionRoles, type StoredSession } from '../domain/authenticated-session';
import { PrismaSessionUserStore, type SessionUserSecurity } from '../infrastructure/prisma-session-user';
import { RedisSessionStore, type SessionInspection } from '../infrastructure/redis-session.store';

export type EstablishedSession = {
  session: AuthenticatedSession;
  refreshed: boolean;
  maxAgeMs: number;
};

@Injectable()
export class SessionAccessService {
  constructor(
    private readonly sessions: RedisSessionStore,
    private readonly users: PrismaSessionUserStore,
  ) {}

  /**
   * Resolves a raw session id into a request principal.
   * The user row is read on every request so a disable or version bump is immediate.
   */
  async establish(rawSessionId: string, now: Date): Promise<EstablishedSession> {
    const inspected = await this.sessions.inspect(rawSessionId, now);
    const stored = requireStoredSession(inspected);
    const user = await this.requireCurrentUser(stored);
    const touched = await this.sessions.touch(rawSessionId, now);
    if (touched.status === 'absent') {
      throw new IdentityError(identityErrorCodes.SESSION_REVOKED);
    }

    return {
      session: toAuthenticatedSession(touched.session, user.role),
      refreshed: touched.refreshed,
      maxAgeMs: touched.session.idleExpiresAt.getTime() - now.getTime(),
    };
  }

  private async requireCurrentUser(stored: StoredSession): Promise<SessionUserSecurity> {
    const user = await this.users.findSecurity(stored.userId, stored.tenantId);
    const current =
      user !== null &&
      user.status === 'ACTIVE' &&
      user.authenticationVersion === stored.authenticationVersion;
    if (!current || user === null) {
      await this.sessions.delete(stored.sessionIdHash);
      throw new IdentityError(identityErrorCodes.SESSION_REVOKED);
    }

    return user;
  }
}

function requireStoredSession(inspected: SessionInspection): StoredSession {
  if (inspected.status === 'invalid') {
    throw new IdentityError(identityErrorCodes.UNAUTHENTICATED);
  }
  if (inspected.status === 'expired') {
    throw new IdentityError(identityErrorCodes.SESSION_EXPIRED);
  }
  if (inspected.status !== 'active') {
    throw new IdentityError(identityErrorCodes.SESSION_REVOKED);
  }

  return inspected.session;
}

function toAuthenticatedSession(stored: StoredSession, role: SessionUserSecurity['role']): AuthenticatedSession {
  const liveRole = sessionRoles.find((value) => value === role);
  if (liveRole === undefined) {
    throw new IdentityError(identityErrorCodes.SESSION_REVOKED);
  }

  return {
    userId: stored.userId,
    tenantId: stored.tenantId,
    role: liveRole,
    authenticationVersion: stored.authenticationVersion,
    sessionHash: stored.sessionIdHash,
  };
}
