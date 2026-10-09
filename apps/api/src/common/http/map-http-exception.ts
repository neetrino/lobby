import { HttpException } from '@nestjs/common';

import { AuthorizationError } from '../auth/authorization';
import { ModuleDisabledError } from '../authorization/module-entitlement';
import { ApiError } from './api-error';
import { apiErrorBody, type ApiErrorBody } from './api-error-body';
import { httpErrorCodes, httpErrorMessages } from './http-error-codes';
import { tryMapIdentityError } from './map-identity-error';
import { ValidationError } from './validation-error';

export type MappedHttpError = {
  statusCode: number;
  body: ApiErrorBody;
};

/**
 * Maps infrastructure, identity, and framework exceptions to the public error body.
 * Identity codes are included here so a controller does not need its own auth filter.
 */
export function mapHttpException(exception: unknown, requestId: string): MappedHttpError {
  const identityError = tryMapIdentityError(exception, requestId);
  if (identityError !== undefined) {
    return identityError;
  }
  if (exception instanceof ModuleDisabledError) {
    return mapped(403, exception.code, exception.message, requestId);
  }
  if (isReservationFailure(exception)) {
    return mapped(exception.statusCode, exception.code, exception.message, requestId);
  }
  if (isContactEmailTaken(exception)) {
    return mapped(409, exception.code, exception.message, requestId);
  }
  if (isPipelineColumnNotEmpty(exception)) {
    return mapped(409, exception.code, exception.message, requestId);
  }
  if (isPipelineConflict(exception)) {
    return mapped(409, exception.code, exception.message, requestId);
  }
  if (isLeadsDisabled(exception)) {
    return mapped(403, exception.code, exception.message, requestId);
  }
  if (exception instanceof AuthorizationError) {
    return mapped(403, exception.code, exception.message, requestId);
  }
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

function isPipelineConflict(
  exception: unknown,
): exception is { code: 'PIPELINE_CONFLICT'; message: string } {
  return (
    exception instanceof Error &&
    exception.name === 'PipelineConflictError' &&
    'code' in exception &&
    exception.code === 'PIPELINE_CONFLICT'
  );
}

function isPipelineColumnNotEmpty(
  exception: unknown,
): exception is { code: 'PIPELINE_COLUMN_NOT_EMPTY'; message: string } {
  return (
    exception instanceof Error &&
    exception.name === 'PipelineColumnNotEmptyError' &&
    'code' in exception &&
    exception.code === 'PIPELINE_COLUMN_NOT_EMPTY'
  );
}

function isLeadsDisabled(
  exception: unknown,
): exception is { code: 'LEADS_DISABLED'; message: string } {
  return (
    exception instanceof Error &&
    exception.name === 'LeadsDisabledError' &&
    'code' in exception &&
    exception.code === 'LEADS_DISABLED'
  );
}

const reservationErrorCodes = new Set([
  'RESERVATION_LOCATION_NOT_FOUND',
  'RESERVATION_TABLE_NOT_FOUND',
  'RESERVATION_TABLE_CAPACITY_EXCEEDED',
  'RESERVATION_OUTSIDE_WORKING_HOURS',
  'RESERVATION_TIME_CONFLICT',
  'RESERVATION_SOURCE_CONFLICT',
  'RESERVATION_CONTACT_NOT_FOUND',
  'RESERVATION_ASSIGNEE_NOT_FOUND',
  'RESERVATION_MODULE_DISABLED',
  'RESERVATION_START_NOT_IN_FUTURE',
  'RESERVATION_NOT_FOUND',
  'RESERVATION_NOT_EDITABLE',
  'RESERVATION_INVALID_TRANSITION',
]);

function isReservationFailure(
  exception: unknown,
): exception is { code: string; message: string; statusCode: number } {
  if (!(exception instanceof Error) || exception.name !== 'ReservationFailure') {
    return false;
  }
  if (!('code' in exception) || !('statusCode' in exception)) {
    return false;
  }
  return (
    typeof exception.code === 'string' &&
    reservationErrorCodes.has(exception.code) &&
    typeof exception.statusCode === 'number'
  );
}

function isContactEmailTaken(
  exception: unknown,
): exception is { code: 'CONTACT_EMAIL_TAKEN'; message: string } {
  return (
    exception instanceof Error &&
    exception.name === 'ContactEmailConflictError' &&
    'code' in exception &&
    exception.code === 'CONTACT_EMAIL_TAKEN'
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
