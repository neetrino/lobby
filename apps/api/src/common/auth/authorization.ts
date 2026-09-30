import type { UserRole } from '../tenant/request-context';
import type { TenantId } from '../tenant/tenant-id';

/**
 * Permission failure for a service or a route guard.
 * The message is fixed. Caller ids are not included.
 */
export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN' as const;

  constructor() {
    super('You do not have permission to perform this action.');
    this.name = 'AuthorizationError';
  }
}

export function roleIsAllowed(role: UserRole, allowed: readonly UserRole[]): boolean {
  return allowed.includes(role);
}

/** Service-level role check. A route guard does not replace this. */
export function requireRole(actor: { role: UserRole }, allowed: readonly UserRole[]): void {
  if (!roleIsAllowed(actor.role, allowed)) {
    throw new AuthorizationError();
  }
}

/**
 * Tenant id for a query or write.
 * The argument must already be a `TenantId` minted from the session.
 * A plain string does not typecheck. An empty id is still rejected here.
 */
export function scopedTenantId(context: { tenantId: TenantId }): TenantId {
  if (context.tenantId.length === 0) {
    throw new AuthorizationError();
  }
  return context.tenantId;
}
