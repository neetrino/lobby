import { HttpException } from '@nestjs/common';

import { ApiError } from './api-error';
import { apiErrorBody, type ApiErrorBody } from './api-error-body';
import { httpErrorCodes, httpErrorMessages } from './http-error-codes';
import { ValidationError } from './validation-error';

export type MappedHttpError = {
  statusCode: number;
  body: ApiErrorBody;
};

/**
 * Maps infrastructure and framework exceptions to the public error body.
 * Identity codes are mapped by IdentityExceptionFilter before this runs.
 */
export function mapHttpException(exception: unknown, requestId: string): MappedHttpError {
  if (exception instanceof ApiError) {
    return mapped(exception.statusCode, exception.code, exception.message, requestId);
  }
  if (exception instanceof ValidationError) {
    return {
      statusCode: 400,
      body: apiErrorBody({
        code: httpErrorCodes.VALIDATION_ERROR,
        message: httpErrorMessages.VALIDATION_ERROR,
        requestId,
        fields: exception.fields,
      }),
    };
  }
  if (exception instanceof HttpException) {
    return mapNestException(exception, requestId);
  }
  return internalError(requestId);
}

function mapNestException(exception: HttpException, requestId: string): MappedHttpError {
  const statusCode = exception.getStatus();
  if (statusCode >= 500) {
    return internalError(requestId, statusCode);
  }
  if (statusCode === 404) {
    return mapped(statusCode, httpErrorCodes.NOT_FOUND, httpErrorMessages.NOT_FOUND, requestId);
  }
  return mapped(
    statusCode,
    httpErrorCodes.REQUEST_REJECTED,
    httpErrorMessages.REQUEST_REJECTED,
    requestId,
  );
}

function mapped(
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
): MappedHttpError {
  return { statusCode, body: apiErrorBody({ code, message, requestId }) };
}

function internalError(requestId: string, statusCode = 500): MappedHttpError {
  return mapped(
    statusCode,
    httpErrorCodes.INTERNAL_ERROR,
    httpErrorMessages.INTERNAL_ERROR,
    requestId,
  );
}
