import { hasPermission } from '../../../common/authorization/require-permission';
import type { SessionRole } from './authenticated-session';

/** Caller of a session-revocation command. Built from the authenticated session, not from client input. */
export type SessionRevocationActor = {
  userId: string;
  tenantId: string;
  role: SessionRole;
};

/**
 * A user may revoke their own sessions.
 * Revoking a different user requires `sessions:revoke`. The service still limits the target to the actor's tenant.
 */
export function canRevokeUserSessions(actor: SessionRevocationActor, targetUserId: string): boolean {
  if (actor.userId === targetUserId) {
    return true;
  }

  return hasPermission(actor.role, 'sessions:revoke');
}
