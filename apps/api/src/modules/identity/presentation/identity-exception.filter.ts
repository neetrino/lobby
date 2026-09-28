import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';

import { ApiError } from '../../../common/http/api-error';
import { IdentityError, type IdentityErrorCode } from '../domain/identity.errors';

type ErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

type ErrorResponse = {
  status(statusCode: number): { json(body: ErrorBody): void };
};

const INTERNAL_ERROR_BODY: ErrorBody = {
  error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' },
};

const REJECTED_REQUEST_BODY: ErrorBody = {
  error: { code: 'REQUEST_REJECTED', message: 'The request could not be processed.' },
};

@Catch()
export class IdentityExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<ErrorResponse>();
    const mapped = mapIdentityException(exception);
    response.status(mapped.statusCode).json(mapped.body);
  }
}

function mapIdentityException(exception: unknown): { statusCode: number; body: ErrorBody } {
  if (exception instanceof ApiError) {
    return {
      statusCode: exception.statusCode,
      body: { error: { code: exception.code, message: exception.message } },
    };
  }

  if (exception instanceof IdentityError) {
    return {
      statusCode: statusFor(exception.code),
      body: { error: { code: exception.code, message: exception.message } },
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    if (statusCode >= 500) {
      return { statusCode, body: INTERNAL_ERROR_BODY };
    }

    return { statusCode, body: REJECTED_REQUEST_BODY };
  }

  return { statusCode: 500, body: INTERNAL_ERROR_BODY };
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
