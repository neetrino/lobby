import { createRequestId, runWithRequestId, type RequestWithId } from './request-context';

type HeaderResponse = {
  setHeader(name: string, value: string): void;
};

type Next = () => void;

/**
 * Assigns a new request id on every call.
 * Client-supplied `X-Request-Id` is ignored so callers cannot forge log correlation.
 */
export function requestIdMiddleware(
  request: RequestWithId,
  response: HeaderResponse,
  next: Next,
): void {
  const requestId = createRequestId();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  runWithRequestId(requestId, () => {
    next();
  });
}
