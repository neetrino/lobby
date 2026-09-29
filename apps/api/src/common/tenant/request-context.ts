import type { AuthenticatedTenantContext, TenantRole } from './authenticated-tenant-context';

/** Session role. Module code uses this name for the authenticated caller. */
export type UserRole = TenantRole;

/**
 * Standard caller for tenant-scoped module work.
 * `tenantId` is copied from the validated session. Request body, query, and headers are not a source.
 */
export type RequestContext = {
  requestId: string;
  userId: string;
  tenantId: string;
  role: UserRole;
};

export function requestContextFromSession(
  session: AuthenticatedTenantContext,
  requestId: string,
): RequestContext {
  return {
    requestId,
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
  };
}
