import type { UserRole } from '../tenant/request-context';

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
 * The only accepted source is the caller context, so a worker or another service cannot pass a different tenant.
 */
export function scopedTenantId(context: { tenantId: string }): string {
  if (context.tenantId.length === 0) {
    throw new AuthorizationError();
  }
  return context.tenantId;
}
