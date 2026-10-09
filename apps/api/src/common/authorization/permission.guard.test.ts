import 'reflect-metadata';
import { Controller, Get, Post, UseGuards, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { AuthorizationError } from '../auth/authorization';
import type { UserRole } from '../tenant/request-context';
import { Authorize, PERMISSIONS_KEY, PermissionGuard } from './permission.guard';

const GUARDS_METADATA = '__guards__';

@Controller('probe')
class PermissionProbeController {
  @Get('open')
  open(): void {}

  @Post('bare')
  @UseGuards(PermissionGuard)
  bare(): void {}

  @Post('revoke')
  @Authorize('sessions:revoke')
  revoke(): void {}
}

describe('permission guard', () => {
  const guard = new PermissionGuard(new Reflector());

  it('rejects a member and allows owner and admin', () => {
    expect(() =>
      guard.canActivate(context(PermissionProbeController.prototype.revoke, 'MEMBER')),
    ).toThrow(AuthorizationError);
    expect(guard.canActivate(context(PermissionProbeController.prototype.revoke, 'OWNER'))).toBe(
      true,
    );
    expect(guard.canActivate(context(PermissionProbeController.prototype.revoke, 'ADMIN'))).toBe(
      true,
    );
  });

  it('binds the permission and the guard from one decorator', () => {
    const handler = PermissionProbeController.prototype.revoke;
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toBe('sessions:revoke');
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(PermissionGuard);
  });

  it('fails closed when the guard is applied without a permission', () => {
    expect(() =>
      guard.canActivate(context(PermissionProbeController.prototype.bare, 'OWNER')),
    ).toThrow(AuthorizationError);
    expect(() =>
      guard.canActivate(context(PermissionProbeController.prototype.open, 'MEMBER')),
    ).toThrow(AuthorizationError);
  });

  it('fails closed when the session is missing', () => {
    expect(() =>
      guard.canActivate(context(PermissionProbeController.prototype.revoke, undefined)),
    ).toThrow(AuthorizationError);
  });
});

function context(
  handler: (...args: never[]) => unknown,
  role: UserRole | undefined,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => PermissionProbeController,
    switchToHttp: () => ({
      getRequest: () => ({ auth: role === undefined ? undefined : { role } }),
    }),
  } as ExecutionContext;
}
