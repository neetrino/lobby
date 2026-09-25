/** Tenant taken from the authenticated user. Callers must not supply a tenant id. */
export type AuthenticatedTenantContext = {
  tenantId: string;
};
