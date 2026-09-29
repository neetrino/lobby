import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type { ArgumentsHost } from '@nestjs/common';

export type RequestWithId = {
  requestId?: string;
};

const requestStorage = new AsyncLocalStorage<{ requestId: string }>();

/** Server-generated id for the current async call stack. */
export function currentRequestId(): string | undefined {
  return requestStorage.getStore()?.requestId;
}

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestStorage.run({ requestId }, fn);
}

export function createRequestId(): string {
  return randomUUID();
}

/**
 * Prefers the id stored by middleware. A missing context gets a new id.
 * The incoming `X-Request-Id` header is never read.
 */
export function resolveRequestId(host: ArgumentsHost): string {
  const stored = currentRequestId();
  if (stored !== undefined && stored.length > 0) {
    return stored;
  }
  const requestId = readRequestProperty(host);
  if (requestId !== undefined) {
    return requestId;
  }
  return createRequestId();
}

function readRequestProperty(host: ArgumentsHost): string | undefined {
  const http = host.switchToHttp();
  if (typeof http.getRequest !== 'function') {
    return undefined;
  }
  const request = http.getRequest<RequestWithId>();
  if (
    request !== undefined &&
    typeof request.requestId === 'string' &&
    request.requestId.length > 0
  ) {
    return request.requestId;
  }
  return undefined;
}
