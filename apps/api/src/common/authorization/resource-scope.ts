import { AuthorizationError } from '../auth/authorization';
import type { RequestContext } from '../tenant/request-context';

/** How a caller is matched to one row. `tenant` matches every row in the caller's tenant. */
export const resourceScopes = ['tenant'] as const;

export type ResourceScope = (typeof resourceScopes)[number];

type ResourceActor = Pick<RequestContext, 'userId' | 'tenantId'>;

type TenantResource = {
  tenantId: string;
};

/**
 * Whether this caller may use this row.
 * `tenant` allows every caller in the row's tenant. It does not compare the caller with an owner or assignee.
 * An empty caller id fails closed.
 */
export function canAccessResource(
  actor: ResourceActor,
  scope: ResourceScope,
  resource: TenantResource,
): boolean {
  if (scope !== 'tenant') {
    return false;
  }
  return (
    actor.userId.length > 0 && actor.tenantId.length > 0 && resource.tenantId === actor.tenantId
  );
}

/**
 * Asserts the tenant-scope invariant for a row whose tenant id came from this actor.
 * A hidden read uses `canAccessResource` and returns not-found instead of throwing.
 */
export function requireResourceScope(
  actor: ResourceActor,
  scope: ResourceScope,
  resource: TenantResource,
): void {
  if (!canAccessResource(actor, scope, resource)) {
    throw new AuthorizationError();
  }
}
