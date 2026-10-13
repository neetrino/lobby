import {
  applyDecorators,
  CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthorizationError } from '../auth/authorization';
import type { UserRole } from '../tenant/request-context';
import { requirePermission } from './require-permission';
import type { Permission } from './role-permissions';

export const PERMISSIONS_KEY = 'permissions';

type AuthorizedRequest = {
  auth?: { role: UserRole };
};

/**
 * Route permission and guard together.
 * Using the guard without this decorator fails closed.
 */
export function Authorize(permission: Permission): MethodDecorator & ClassDecorator {
  return applyDecorators(SetMetadata(PERMISSIONS_KEY, permission), UseGuards(PermissionGuard));
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permission === undefined) {
      throw new AuthorizationError();
    }
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (request.auth === undefined) {
      throw new AuthorizationError();
    }
    requirePermission(request.auth, permission);
    return true;
  }
}
