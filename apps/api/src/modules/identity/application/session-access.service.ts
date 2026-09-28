import { Injectable } from '@nestjs/common';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import type { StoredSession } from '../domain/authenticated-session';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore, type SessionInspection } from '../infrastructure/redis-session.store';

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
  async establish(rawSessionId: string, now: Date): Promise<AuthenticatedSession> {
    const inspected = await this.sessions.inspect(rawSessionId, now);
    const stored = requireStoredSession(inspected);
    await this.requireCurrentUser(stored);
    const touched = await this.sessions.touch(rawSessionId, now);
    if (touched === null) {
      throw new IdentityError(identityErrorCodes.SESSION_REVOKED);
    }

    return toAuthenticatedSession(touched);
  }

  private async requireCurrentUser(stored: StoredSession): Promise<void> {
    const user = await this.users.findSecurity(stored.userId, stored.tenantId);
    const current =
      user !== null &&
      user.status === 'ACTIVE' &&
      user.authenticationVersion === stored.authenticationVersion;
    if (current) {
      return;
    }

    await this.sessions.delete(stored.sessionIdHash);
    throw new IdentityError(identityErrorCodes.SESSION_REVOKED);
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

function toAuthenticatedSession(stored: StoredSession): AuthenticatedSession {
  return {
    userId: stored.userId,
    tenantId: stored.tenantId,
    role: stored.role,
    authenticationVersion: stored.authenticationVersion,
    sessionHash: stored.sessionIdHash,
  };
}
