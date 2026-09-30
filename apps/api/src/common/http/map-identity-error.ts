import { AuthenticationError } from '../auth/authentication.error';
import { apiErrorBody, type ApiErrorBody } from './api-error-body';

export type MappedIdentityError = {
  statusCode: number;
  body: ApiErrorBody;
};

/** Maps an authentication failure, including module errors that extend the shared contract. */
export function tryMapIdentityError(
  exception: unknown,
  requestId: string,
): MappedIdentityError | undefined {
  if (!(exception instanceof AuthenticationError)) {
    return undefined;
  }
  return {
    statusCode: exception.statusCode,
    body: apiErrorBody({ code: exception.code, message: exception.message, requestId }),
  };
}
