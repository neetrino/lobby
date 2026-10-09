import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

/** Stable id for filter unit tests. HTTP tests use the middleware's UUID instead. */
export const TEST_REQUEST_ID = 'request-id';

export function captureException(
  filter: ExceptionFilter,
  exception: unknown,
): { statusCode: number; body: unknown } {
  const state: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
  const response = {
    status(statusCode: number) {
      state.statusCode = statusCode;
      return {
        json(body: unknown) {
          state.body = body;
        },
      };
    },
  };
  filter.catch(exception, exceptionHost(response));
  return state;
}

function exceptionHost(response: {
  status(statusCode: number): { json(body: unknown): void };
}): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ requestId: TEST_REQUEST_ID }),
      getResponse: () => response,
    }),
  } as ArgumentsHost;
}
