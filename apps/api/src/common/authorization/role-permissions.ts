import type { UserRole } from '../tenant/request-context';

/** Actions a route or service may require. Add a key only when a real caller needs it. */
export const permissions = [
  'sessions:revoke',
  'audit:read',
  'contacts:create',
  'contacts:read',
  'contacts:update',
  'leads:create',
  'leads:read',
  'leads:update',
  'leads:delete',
  'deals:create',
  'deals:read',
  'deals:update',
  'deals:delete',
  'pipelines:configure',
  'reservations:read',
  'dashboard:read',
  'members:invite',
  'platform:provision',
] as const;

export type Permission = (typeof permissions)[number];

const workspaceAccess = [
  'contacts:create',
  'contacts:read',
  'contacts:update',
  'leads:create',
  'leads:read',
  'leads:update',
  'leads:delete',
  'deals:create',
  'deals:read',
  'deals:update',
  'deals:delete',
  'reservations:read',
  'dashboard:read',
] as const satisfies readonly Permission[];

/**
 * Role to permission map.
 * Every role may use contacts, lead cards, and deal cards, read the reservation summary, and open the dashboard.
 * Owner and Admin may also configure a board, revoke another user's sessions, read audit history, and invite members.
 * Only Owner has `platform:provision`. A customer Owner still fails the platform-tenant guard.
 * Revoking your own sessions is not a permission.
 * A dashboard widget still checks its own module entitlement and permission.
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  OWNER: [
    'platform:provision',
    'sessions:revoke',
    'audit:read',
    'members:invite',
    'pipelines:configure',
    ...workspaceAccess,
  ],
  ADMIN: ['sessions:revoke', 'audit:read', 'members:invite', 'pipelines:configure', ...workspaceAccess],
  MEMBER: [...workspaceAccess],
};
