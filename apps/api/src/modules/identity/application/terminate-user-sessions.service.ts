import { Injectable } from '@nestjs/common';

import { AuthorizationError } from '../../../common/auth/authorization';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { canRevokeUserSessions, type SessionRevocationActor } from '../domain/session-revocation';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionStoreUnavailableError } from '../infrastructure/session-store-error';

@Injectable()
export class TerminateUserSessionsService {
  constructor(
    private readonly users: PrismaSessionUserStore,
    private readonly sessions: RedisSessionStore,
  ) {}

  /**
   * Revokes every session for one user before returning.
   * The version increment is committed first, then Redis session keys and the reverse index are deleted.
   * The outbox is not part of revocation. An audit or notification write may happen only after this method returns.
   * The caller may revoke their own sessions. Another user is allowed only through canRevokeUserSessions.
   */
  async terminateAllSessions(actor: SessionRevocationActor, targetUserId: string): Promise<void> {
    if (!canRevokeUserSessions(actor, targetUserId)) {
      throw new AuthorizationError();
    }

    const version = await this.users.incrementAuthenticationVersion(targetUserId, actor.tenantId);
    if (version === null) {
      throw new IdentityError(identityErrorCodes.FORBIDDEN);
    }

    try {
      await this.sessions.deleteAllForUser(targetUserId);
    } catch (error) {
      if (error instanceof SessionStoreUnavailableError) {
        throw new IdentityError(identityErrorCodes.SERVICE_UNAVAILABLE);
      }
      throw error;
    }
  }
}
