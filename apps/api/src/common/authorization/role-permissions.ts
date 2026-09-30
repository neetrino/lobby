import type { UserRole } from '../tenant/request-context';

/** Actions a route or service may require. Add a key only when a real caller needs it. */
export const permissions = [
  'sessions:revoke',
  'contacts:create',
  'contacts:read',
  'contacts:update',
] as const;

export type Permission = (typeof permissions)[number];

const contactAccess = [
  'contacts:create',
  'contacts:read',
  'contacts:update',
] as const satisfies readonly Permission[];

/**
 * Role to permission map.
 * Every role may create, read, and update contacts in its tenant.
 * Owner and Admin may also revoke another user's sessions.
 * Revoking your own sessions is not a permission.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  OWNER: ['sessions:revoke', ...contactAccess],
  ADMIN: ['sessions:revoke', ...contactAccess],
  MEMBER: [...contactAccess],
};
