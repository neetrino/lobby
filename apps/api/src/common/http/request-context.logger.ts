import { ConsoleLogger, type LoggerService } from '@nestjs/common';

import { currentRequestId } from './request-context';

/** Prefixes each log line with the active request id when a request is in progress. */
export class RequestContextLogger implements LoggerService {
  constructor(private readonly inner = new ConsoleLogger()) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.inner.log(withRequestId(message), ...optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.inner.error(withRequestId(message), ...optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.inner.warn(withRequestId(message), ...optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.inner.debug(withRequestId(message), ...optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.inner.verbose(withRequestId(message), ...optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.inner.fatal(withRequestId(message), ...optionalParams);
  }
}

function withRequestId(message: unknown): unknown {
  const requestId = currentRequestId();
  if (requestId === undefined || typeof message !== 'string' || message.includes(requestId)) {
    return message;
  }
  return `[${requestId}] ${message}`;
}
