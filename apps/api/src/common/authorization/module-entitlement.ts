import { AuthorizationError } from '../auth/authorization';
import type { TenantId } from '../tenant/tenant-id';

/** Optional product modules. Identity and health are not in this catalog. */
export const productModules = ['contacts'] as const;

export type ProductModule = (typeof productModules)[number];

export type ModuleState = 'enabled' | 'disabled';

/**
 * Entitlement for every tenant.
 * An owner-level per-tenant toggle is not stored yet. A module set to `disabled` here is off for every tenant.
 * A module absent from this catalog cannot be required.
 */
export const moduleEntitlements = {
  contacts: 'enabled',
} as const satisfies Record<ProductModule, ModuleState>;

/** True only when the policy explicitly enables the module. */
export function isModuleEnabled(
  module: ProductModule,
  policy: Record<ProductModule, ModuleState>,
): boolean {
  return policy[module] === 'enabled';
}

/**
 * Module gate. Call it before the action permission.
 * An empty tenant id fails closed. A disabled module fails closed even when the role has the permission.
 */
export function requireModule(actor: { tenantId: TenantId }, module: ProductModule): void {
  if (actor.tenantId.length === 0 || !isModuleEnabled(module, moduleEntitlements)) {
    throw new AuthorizationError();
  }
}
