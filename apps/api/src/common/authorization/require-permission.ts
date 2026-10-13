import { AuthorizationError } from '../auth/authorization';
import type { UserRole } from '../tenant/request-context';
import { ROLE_PERMISSIONS, type Permission } from './role-permissions';

/** True when the role's map includes the permission. An unknown role fails closed. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Service-level permission check. A route guard does not replace this.
 * The thrown error code is `FORBIDDEN`. The permission key is not part of the client message.
 */
export function requirePermission(actor: { role: UserRole }, permission: Permission): void {
  if (!hasPermission(actor.role, permission)) {
    throw new AuthorizationError();
  }
}
