import type { ModuleKey, TenantPlan } from '@lobby/contracts';

/**
 * The only plan-to-module map.
 * Registration inserts these rows in the same transaction as the tenant.
 * A module that is not listed is not inserted, and a missing row stays disabled.
 */
export const planModules = {
  starter: ['contacts', 'deals'],
} as const satisfies Record<TenantPlan, readonly ModuleKey[]>;
