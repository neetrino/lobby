import { Logger, type ArgumentsHost } from '@nestjs/common';

import { httpErrorCodes } from './http-error-codes';
import { mapHttpException, type MappedHttpError } from './map-http-exception';
import { resolveRequestId } from './request-context';

type HttpReply = {
  status(statusCode: number): { json(body: MappedHttpError['body']): void };
  setHeader?(name: string, value: string): void;
};

type HttpRequestSnapshot = {
  method?: unknown;
  path?: unknown;
  originalUrl?: unknown;
  url?: unknown;
};

const unexpectedLogger = new Logger('ExceptionFilter');
const UNHANDLED_DESCRIPTION = 'Unhandled exception';

/**
 * Writes the mapped body and logs unexpected failures with the request id.
 * The client body stays the generic internal error.
 */
export function respondWithMappedException(
  exception: unknown,
  host: ArgumentsHost,
  map: (exception: unknown, requestId: string) => MappedHttpError = mapHttpException,
): void {
  const requestId = resolveRequestId(host);
  const mapped = map(exception, requestId);
  if (mapped.body.error.code === httpErrorCodes.INTERNAL_ERROR) {
    logUnexpectedException(exception, requestId, host);
  }
  const response = host.switchToHttp().getResponse<HttpReply>();
  response.setHeader?.('X-Request-Id', requestId);
  response.status(mapped.statusCode).json(mapped.body);
}

/**
 * Unexpected failures are logged without `Error.message` or `Error.stack`.
 * TODO(http-foundation-review): a later task can add one redaction function
 * (connection strings, bearer tokens, emails) and only then attach a redacted stack.
 */
function logUnexpectedException(exception: unknown, requestId: string, host: ArgumentsHost): void {
  const { method, route } = readRequestRoute(host);
  unexpectedLogger.error(
    JSON.stringify({
      requestId,
      exception: exceptionName(exception),
      description: UNHANDLED_DESCRIPTION,
      timestamp: new Date().toISOString(),
      method,
      route,
    }),
  );
}

function readRequestRoute(host: ArgumentsHost): { method: string; route: string } {
  const request = host.switchToHttp().getRequest<HttpRequestSnapshot>();
  const path = request?.path ?? request?.originalUrl ?? request?.url;
  return {
    method: textOrUnknown(request?.method),
    route: stripQuery(textOrUnknown(path)),
  };
}

function exceptionName(exception: unknown): string {
  if (typeof exception !== 'object' || exception === null) {
    return 'UnknownException';
  }
  const name = exception.constructor?.name;
  if (typeof name === 'string' && name.length > 0) {
    return name;
  }
  return 'UnknownException';
}

function textOrUnknown(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : 'unknown';
}

function stripQuery(route: string): string {
  const queryIndex = route.indexOf('?');
  return queryIndex === -1 ? route : route.slice(0, queryIndex);
}
