import { AuthorizationError } from '../auth/authorization';

/** How a caller is matched to one row. `tenant` matches every row in the caller's tenant. */
export const resourceScopes = ['tenant'] as const;

export type ResourceScope = (typeof resourceScopes)[number];

type ResourceActor = {
  userId: string;
  tenantId: string;
};

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
  return actor.userId.length > 0 && actor.tenantId.length > 0 && resource.tenantId === actor.tenantId;
}

/**
 * Service-level scope check for a write the caller is about to perform.
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
