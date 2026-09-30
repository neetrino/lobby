import {
  authenticationErrorCodes,
  type AuthenticationErrorCode,
} from './authentication-error-codes';
import { CataloguedClientError, type ClientErrorSpec } from './catalogued-client-error';

/** Fixed client copy for every authentication code. There is no caller-supplied message. */
export const authenticationCatalog = {
  [authenticationErrorCodes.INVALID_CREDENTIALS]: {
    message: 'Invalid credentials.',
    statusCode: 401,
  },
  [authenticationErrorCodes.UNAUTHENTICATED]: {
    message: 'Authentication is required.',
    statusCode: 401,
  },
  [authenticationErrorCodes.SESSION_EXPIRED]: {
    message: 'The session has expired.',
    statusCode: 401,
  },
  [authenticationErrorCodes.SESSION_REVOKED]: {
    message: 'The session is no longer valid.',
    statusCode: 401,
  },
} as const satisfies Record<AuthenticationErrorCode, ClientErrorSpec>;

/**
 * Authentication failure. The only argument is a catalog code.
 * Message and HTTP status come from `authenticationCatalog`.
 */
export class AuthenticationError extends CataloguedClientError {
  override readonly code: AuthenticationErrorCode;

  constructor(code: AuthenticationErrorCode) {
    super(code, authenticationCatalog[code]);
    this.code = code;
  }
}
