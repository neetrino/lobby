import { describe, expect, it } from 'vitest';

import { AuthorizationError, scopedTenantId } from '../auth/authorization';
import { requestContextFromSession } from '../tenant/request-context';
import { hasPermission, requirePermission } from './require-permission';
import { ROLE_PERMISSIONS } from './role-permissions';

const contactPermissions = ['contacts:create', 'contacts:read', 'contacts:update'] as const;
const workspacePermissions = [
  ...contactPermissions,
  'leads:create',
  'leads:read',
  'leads:update',
  'leads:delete',
  'deals:create',
  'deals:read',
  'deals:update',
  'deals:delete',
  'reservations:create',
  'reservations:read',
  'dashboard:read',
  'pipelines:resize',
  'team:read',
  'team:message',
] as const;

describe('role permissions', () => {
  it('grants sessions:revoke and audit:read to owner and admin and withholds both from member', () => {
    expect(hasPermission('MEMBER', 'sessions:revoke')).toBe(false);
    expect(hasPermission('MEMBER', 'audit:read')).toBe(false);
    expect(hasPermission('OWNER', 'sessions:revoke')).toBe(true);
    expect(hasPermission('OWNER', 'audit:read')).toBe(true);
    expect(hasPermission('ADMIN', 'sessions:revoke')).toBe(true);
    expect(hasPermission('ADMIN', 'audit:read')).toBe(true);
    expect(ROLE_PERMISSIONS.MEMBER).not.toContain('sessions:revoke');
    expect(ROLE_PERMISSIONS.MEMBER).not.toContain('audit:read');
  });

  it('grants contact create, read, and update to owner, admin, and member', () => {
    for (const role of ['OWNER', 'ADMIN', 'MEMBER'] as const) {
      expect(hasPermission(role, 'contacts:create')).toBe(true);
      expect(hasPermission(role, 'contacts:read')).toBe(true);
      expect(hasPermission(role, 'contacts:update')).toBe(true);
      expect(() => requirePermission({ role }, 'contacts:create')).not.toThrow();
      expect(() => requirePermission({ role }, 'contacts:read')).not.toThrow();
      expect(() => requirePermission({ role }, 'contacts:update')).not.toThrow();
    }
    expect(hasPermission('MEMBER', 'members:invite')).toBe(false);
    expect(hasPermission('OWNER', 'members:invite')).toBe(true);
    expect(hasPermission('ADMIN', 'members:invite')).toBe(true);
    expect(ROLE_PERMISSIONS.MEMBER).toEqual([...workspacePermissions]);
    expect(hasPermission('MEMBER', 'pipelines:resize')).toBe(true);
    expect(hasPermission('MEMBER', 'pipelines:configure')).toBe(false);
    expect(hasPermission('OWNER', 'pipelines:configure')).toBe(true);
    expect(hasPermission('ADMIN', 'pipelines:configure')).toBe(true);
    expect(ROLE_PERMISSIONS.ADMIN).toEqual([
      'sessions:revoke',
      'audit:read',
      'members:invite',
      'pipelines:configure',
      'team:manage',
      ...workspacePermissions,
    ]);
    expect(hasPermission('OWNER', 'platform:provision')).toBe(true);
    expect(hasPermission('ADMIN', 'platform:provision')).toBe(false);
    expect(hasPermission('MEMBER', 'platform:provision')).toBe(false);
    expect(ROLE_PERMISSIONS.OWNER).toEqual(['platform:provision', ...ROLE_PERMISSIONS.ADMIN]);
  });

  it('rejects a missing permission without HTTP and allows a role that has it', () => {
    expect(() => requirePermission({ role: 'MEMBER' }, 'sessions:revoke')).toThrow(
      AuthorizationError,
    );
    expect(() => requirePermission({ role: 'ADMIN' }, 'sessions:revoke')).not.toThrow();
    expect(() => requirePermission({ role: 'OWNER' }, 'sessions:revoke')).not.toThrow();
  });

  it('keeps the tenant scope check available without the HTTP guard', () => {
    expect(scopedTenantId(sessionContext('tenant-a'))).toBe('tenant-a');
    expect(() => scopedTenantId(sessionContext(''))).toThrow(AuthorizationError);
  });
});

function sessionContext(tenantId: string) {
  return requestContextFromSession(
    { tenantId, userId: '11111111-1111-4111-8111-111111111111', role: 'OWNER' },
    '44444444-4444-4444-8444-444444444444',
  );
}
