import { scopedTenantId } from '../src/common/auth/authorization';

/** Typecheck rejects a plain string used as the tenant scope. */
export function plainStringIsNotATenantId(): void {
  // @ts-expect-error A plain string is not a session tenant id.
  scopedTenantId({ tenantId: 'some-tenant-id' });
}
