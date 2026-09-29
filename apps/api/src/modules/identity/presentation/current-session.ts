import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { currentRequestId, type RequestWithId } from '../../../common/http/request-context';
import { type AuthenticatedTenantContext } from '../../../common/tenant/authenticated-tenant-context';
import {
  requestContextFromSession,
  type RequestContext,
} from '../../../common/tenant/request-context';
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

/** Full module context: server request id plus the session user, tenant, and role. */
export const CurrentRequest = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestContext => {
    const request = context.switchToHttp().getRequest<RequestWithAuth & RequestWithId>();
    return requestContextFromSession(readAuthenticatedSession(request), requireRequestId(request));
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

function requireRequestId(request: RequestWithId): string {
  const stored = currentRequestId();
  if (stored !== undefined && stored.length > 0) {
    return stored;
  }
  if (typeof request.requestId === 'string' && request.requestId.length > 0) {
    return request.requestId;
  }
  throw new Error('Request id is missing');
}
