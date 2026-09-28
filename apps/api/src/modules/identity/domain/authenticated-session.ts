import type { TenantRole } from '../../../common/tenant/authenticated-tenant-context';

export {
  tenantRoles as sessionRoles,
  type TenantRole as SessionRole,
} from '../../../common/tenant/authenticated-tenant-context';

/**
 * Session record stored in Redis.
 * `sessionIdHash` is the Redis key digest. The raw session id is not part of this object.
 */
export type StoredSession = {
  sessionIdHash: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
  authenticationVersion: number;
  createdAt: Date;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};
