import { CataloguedClientError } from '../auth/catalogued-client-error';
import { apiErrorBody, type ApiErrorBody } from './api-error-body';

export type MappedIdentityError = {
  statusCode: number;
  body: ApiErrorBody;
};

/** Maps a catalogued client error. The body uses the catalog payload, not `Error.message`. */
export function tryMapIdentityError(
  exception: unknown,
  requestId: string,
): MappedIdentityError | undefined {
  if (!(exception instanceof CataloguedClientError)) {
    return undefined;
  }
  const payload = exception.toClientPayload();
  return {
    statusCode: payload.statusCode,
    body: apiErrorBody({ code: payload.code, message: payload.message, requestId }),
  };
}
