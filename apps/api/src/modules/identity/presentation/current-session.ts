import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { type AuthenticatedTenantContext } from '../../../common/tenant/authenticated-tenant-context';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';

type RequestWithAuth = {
  auth?: AuthenticatedSession;
};

/** Reads the principal SessionGuard stored. It does not accept a client tenant id. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    return readAuthenticatedSession(context.switchToHttp().getRequest<RequestWithAuth>());
  },
);

/** Tenant scope copied only from the validated session. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedTenantContext => {
    return tenantContextFromSession(
      readAuthenticatedSession(context.switchToHttp().getRequest<RequestWithAuth>()),
    );
  },
);

export function readAuthenticatedSession(request: RequestWithAuth): AuthenticatedSession {
  if (request.auth === undefined) {
    throw new IdentityError(identityErrorCodes.UNAUTHENTICATED);
  }

  return request.auth;
}

export function tenantContextFromSession(
  session: AuthenticatedSession,
): AuthenticatedTenantContext {
  return {
    tenantId: session.tenantId,
    userId: session.userId,
    role: session.role,
  };
}
