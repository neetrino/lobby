import { Injectable } from '@nestjs/common';
import { auditActions, type AuthenticationVersionChange } from '@lobby/contracts';

import { AuthorizationError } from '../../../common/auth/authorization';
import { AuditEventStore, type AuditWrite } from '../../../common/audit/audit-event.store';
import type { RequestContext } from '../../../common/tenant/request-context';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { canRevokeUserSessions } from '../domain/session-revocation';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionStoreUnavailableError } from '../infrastructure/session-store-error';

export type AuditClient = {
  ipHash: string | null;
  userAgent: string | null;
};

@Injectable()
export class TerminateUserSessionsService {
  constructor(
    private readonly users: PrismaSessionUserStore,
    private readonly sessions: RedisSessionStore,
    private readonly audit: AuditEventStore,
  ) {}

  /**
   * Revokes every session for one user.
   * The version increment and the SUCCESS audit row commit together. Redis deletion follows.
   * A denial writes DENIED and does not change the version.
   */
  async terminateAllSessions(
    context: RequestContext,
    targetUserId: string,
    client: AuditClient,
  ): Promise<void> {
    if (!canRevokeUserSessions(actorFrom(context), targetUserId)) {
      await this.recordDenial(context, targetUserId, client);
      throw new AuthorizationError();
    }

    const committed = await this.commitRevocation(context, targetUserId, client);
    if (!committed) {
      await this.recordDenial(context, targetUserId, client);
      throw new IdentityError(identityErrorCodes.FORBIDDEN);
    }

    await this.deleteSessions(targetUserId);
  }

  private commitRevocation(
    context: RequestContext,
    targetUserId: string,
    client: AuditClient,
  ): Promise<boolean> {
    return this.audit.transaction(async (tx) => {
      const next = await this.users.incrementAuthenticationVersion(
        targetUserId,
        context.tenantId,
        tx,
      );
      if (next === null) {
        return false;
      }
      await this.audit.append(tx, successRecord(context, targetUserId, client, next));
      return true;
    });
  }

  private recordDenial(
    context: RequestContext,
    targetUserId: string,
    client: AuditClient,
  ): Promise<void> {
    return this.audit.appendNow(baseRecord(context, targetUserId, client, 'DENIED', null));
  }

  private async deleteSessions(targetUserId: string): Promise<void> {
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

function actorFrom(context: RequestContext) {
  return { userId: context.userId, tenantId: context.tenantId, role: context.role };
}

function successRecord(
  context: RequestContext,
  targetUserId: string,
  client: AuditClient,
  nextVersion: number,
): AuditWrite {
  return baseRecord(context, targetUserId, client, 'SUCCESS', {
    authenticationVersion: { from: nextVersion - 1, to: nextVersion },
  });
}

function baseRecord(
  context: RequestContext,
  targetUserId: string,
  client: AuditClient,
  outcome: 'SUCCESS' | 'DENIED',
  changes: AuthenticationVersionChange | null,
): AuditWrite {
  return {
    tenantId: context.tenantId,
    actorUserId: context.userId,
    actorRole: context.role,
    actorType: 'USER',
    action: auditActions.USER_SESSIONS_TERMINATED,
    resourceType: 'user',
    resourceId: targetUserId,
    outcome,
    changes,
    reason: null,
    requestId: context.requestId,
    ipHash: client.ipHash,
    userAgent: client.userAgent,
  };
}
