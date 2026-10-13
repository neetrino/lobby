import type { TenantRole } from '../tenant/authenticated-tenant-context';

/**
 * Principal attached to the request after SessionGuard.
 * `sessionHash` is the Redis key digest. The raw session id is not included.
 */
export type AuthenticatedSession = {
  userId: string;
  tenantId: string;
  role: TenantRole;
  authenticationVersion: number;
  sessionHash: string;
};
