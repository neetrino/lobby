import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';

import { mapHttpException, type MappedHttpError } from '../../../common/http/map-http-exception';
import { apiErrorBody } from '../../../common/http/api-error-body';
import { respondWithMappedException } from '../../../common/http/respond-with-http-error';
import { IdentityError, type IdentityErrorCode } from '../domain/identity.errors';

/**
 * Auth routes keep their stable codes. Every other exception uses the global mapper.
 */
@Catch()
export class IdentityExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    respondWithMappedException(exception, host, mapIdentityException);
  }
}

function mapIdentityException(exception: unknown, requestId: string): MappedHttpError {
  if (exception instanceof IdentityError) {
    return {
      statusCode: statusFor(exception.code),
      body: apiErrorBody({ code: exception.code, message: exception.message, requestId }),
    };
  }
  return mapHttpException(exception, requestId);
}

function statusFor(code: IdentityErrorCode): number {
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
