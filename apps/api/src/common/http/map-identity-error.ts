import { IdentityError, type IdentityErrorCode } from '../../modules/identity/domain/identity.errors';
import { apiErrorBody, type ApiErrorBody } from './api-error-body';

export type MappedIdentityError = {
  statusCode: number;
  body: ApiErrorBody;
};

/** Maps an identity failure. Other exceptions return undefined so the HTTP mapper continues. */
export function tryMapIdentityError(
  exception: unknown,
  requestId: string,
): MappedIdentityError | undefined {
  if (!(exception instanceof IdentityError)) {
    return undefined;
  }
  return {
    statusCode: statusForIdentityError(exception.code),
    body: apiErrorBody({ code: exception.code, message: exception.message, requestId }),
  };
}

function statusForIdentityError(code: IdentityErrorCode): number {
  switch (code) {
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHENTICATED':
    case 'SESSION_EXPIRED':
    case 'SESSION_REVOKED':
      return 401;
    case 'FORBIDDEN':
    case 'REGISTRATION_DISABLED':
      return 403;
    case 'TENANT_SUBDOMAIN_TAKEN':
      return 409;
    case 'ACCOUNT_CREATED_SIGN_IN_REQUIRED':
    case 'SERVICE_UNAVAILABLE':
      return 503;
  }
}
