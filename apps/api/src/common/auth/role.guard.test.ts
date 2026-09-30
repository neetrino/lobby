import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { SessionController } from '../../modules/identity/presentation/session.controller';
import type { UserRole } from '../tenant/request-context';
import { AuthorizationError, requireRole, scopedTenantId } from './authorization';
import { RoleGuard } from './role.guard';

describe('role authorization', () => {
  const guard = new RoleGuard(new Reflector());

  it('rejects a member on an owner-or-admin route and allows that role through', () => {
    expect(() => guard.canActivate(context(SessionController.prototype.terminateUser, 'MEMBER'))).toThrow(
      AuthorizationError,
    );
    expect(guard.canActivate(context(SessionController.prototype.terminateUser, 'OWNER'))).toBe(true);
    expect(guard.canActivate(context(SessionController.prototype.terminateUser, 'ADMIN'))).toBe(true);
  });

  it('does not apply a role list to a route that has none', () => {
    expect(guard.canActivate(context(SessionController.prototype.session, 'MEMBER'))).toBe(true);
  });

  it('fails closed when the session is missing', () => {
    expect(() => guard.canActivate(context(SessionController.prototype.terminateUser, undefined))).toThrow(
      AuthorizationError,
    );
  });

  it('keeps the role and tenant checks available without the HTTP guard', () => {
    expect(() => requireRole({ role: 'MEMBER' }, ['OWNER', 'ADMIN'])).toThrow(AuthorizationError);
    expect(scopedTenantId({ tenantId: 'tenant-a' })).toBe('tenant-a');
    expect(() => scopedTenantId({ tenantId: '' })).toThrow(AuthorizationError);
  });
});

function context(handler: (...args: never[]) => unknown, role: UserRole | undefined): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => SessionController,
    switchToHttp: () => ({
      getRequest: () => ({ auth: role === undefined ? undefined : { role } }),
    }),
  } as ExecutionContext;
}
