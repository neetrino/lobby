import { roleIsAllowed } from '../../../common/auth/authorization';
import { tenantManagerRoles } from '../../../common/tenant/authenticated-tenant-context';
import type { SessionRole } from './authenticated-session';

/** Caller of a session-revocation command. Built from the authenticated session, not from client input. */
export type SessionRevocationActor = {
  userId: string;
  tenantId: string;
  role: SessionRole;
};

/**
 * A user may revoke their own sessions.
 * Revoking a different user requires Owner or Admin. The service still limits the target to the actor's tenant.
 */
export function canRevokeUserSessions(actor: SessionRevocationActor, targetUserId: string): boolean {
  if (actor.userId === targetUserId) {
    return true;
  }

  return roleIsAllowed(actor.role, tenantManagerRoles);
}
