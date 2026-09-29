import { Logger, type ArgumentsHost } from '@nestjs/common';

import { httpErrorCodes } from './http-error-codes';
import { mapHttpException, type MappedHttpError } from './map-http-exception';
import { resolveRequestId } from './request-context';

type HttpReply = {
  status(statusCode: number): { json(body: MappedHttpError['body']): void };
  setHeader?(name: string, value: string): void;
};

const unexpectedLogger = new Logger('ExceptionFilter');

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
    unexpectedLogger.error(`${requestId} ${detailOf(exception)}`);
  }
  const response = host.switchToHttp().getResponse<HttpReply>();
  response.setHeader?.('X-Request-Id', requestId);
  response.status(mapped.statusCode).json(mapped.body);
}

function detailOf(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.stack ?? exception.message;
  }
  return 'Non-error failure';
}
