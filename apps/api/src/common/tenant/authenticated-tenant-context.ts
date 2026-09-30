/** Roles stored on the user and copied onto the session. */
export const tenantRoles = ['OWNER', 'ADMIN', 'MEMBER'] as const;

export type TenantRole = (typeof tenantRoles)[number];

/** Roles that may act on another user in the same tenant. */
export const tenantManagerRoles = ['OWNER', 'ADMIN'] as const satisfies readonly TenantRole[];

/**
 * Caller identity for a tenant-scoped operation.
 * Build it only from a validated session. Never from a body, query, or header.
 */
export type AuthenticatedTenantContext = {
  tenantId: string;
  userId: string;
  role: TenantRole;
};
