declare const tenantIdBrand: unique symbol;

/**
 * Tenant id copied from a validated session inside `requestContextFromSession`.
 * A plain string is not assignable. There is no public factory.
 */
export type TenantId = string & { readonly [tenantIdBrand]: true };
