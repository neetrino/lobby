import { CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { UserRole } from '../tenant/request-context';
import { AuthorizationError, requireRole } from './authorization';

export const ROLES_KEY = 'roles';

/** Route-level allow-list. SessionGuard must run first and set `request.auth`. */
export function Roles(...roles: readonly UserRole[]): MethodDecorator & ClassDecorator {
  return SetMetadata(ROLES_KEY, roles);
}

type AuthorizedRequest = {
  auth?: { role: UserRole };
};

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<readonly UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed === undefined || allowed.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (request.auth === undefined) {
      throw new AuthorizationError();
    }
    requireRole(request.auth, allowed);
    return true;
  }
}
