import { Injectable } from '@nestjs/common';

import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import {
  canRevokeUserSessions,
  type SessionRevocationActor,
} from '../domain/session-revocation';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore } from '../infrastructure/redis-session.store';

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
   * Targeting another user is allowed only when the actor may revoke that tenant's sessions.
   */
  async terminateAllSessions(actor: SessionRevocationActor, targetUserId: string): Promise<void> {
    if (!canRevokeUserSessions(actor, targetUserId)) {
      throw new IdentityError(identityErrorCodes.FORBIDDEN);
    }

    const version = await this.users.incrementAuthenticationVersion(targetUserId, actor.tenantId);
    if (version === null) {
      throw new IdentityError(identityErrorCodes.FORBIDDEN);
    }

    await this.sessions.deleteAllForUser(targetUserId);
  }
}
