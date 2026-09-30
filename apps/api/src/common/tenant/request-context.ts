import type { AuthenticatedTenantContext, TenantRole } from './authenticated-tenant-context';
import type { TenantId } from './tenant-id';

/** Session role. Module code uses this name for the authenticated caller. */
export type UserRole = TenantRole;

/**
 * Standard caller for tenant-scoped module work.
 * `tenantId` is a `TenantId` minted here from the validated session.
 * Request body, query, and headers are not a source.
 */
export type RequestContext = {
  requestId: string;
  userId: string;
  tenantId: TenantId;
  role: UserRole;
};

export function requestContextFromSession(
  session: AuthenticatedTenantContext,
  requestId: string,
): RequestContext {
  return {
    requestId,
    userId: session.userId,
    tenantId: tenantIdFromSession(session.tenantId),
    role: session.role,
  };
}

function tenantIdFromSession(raw: string): TenantId {
  return raw as TenantId;
}
