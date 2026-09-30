import {
  authenticationErrorCodes,
  isAuthenticationErrorCode,
  type AuthenticationErrorCode,
} from './authentication-error-codes';

const authenticationMessages = {
  [authenticationErrorCodes.INVALID_CREDENTIALS]: 'Invalid credentials.',
  [authenticationErrorCodes.UNAUTHENTICATED]: 'Authentication is required.',
  [authenticationErrorCodes.SESSION_EXPIRED]: 'The session has expired.',
  [authenticationErrorCodes.SESSION_REVOKED]: 'The session is no longer valid.',
} as const satisfies Record<AuthenticationErrorCode, string>;

/**
 * Authentication failure with a stable code and HTTP status.
 * Module-specific auth errors extend this class. `common` does not import those modules.
 */
export class AuthenticationError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: string,
    message?: string,
    statusCode?: number,
  ) {
    const known = isAuthenticationErrorCode(code) ? code : undefined;
    const fallback = known !== undefined ? authenticationMessages[known] : 'Authentication failed.';
    super(message ?? fallback);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode ?? (known !== undefined ? authenticationStatus(known) : 401);
  }
}

export function authenticationStatus(code: AuthenticationErrorCode): number {
  switch (code) {
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHENTICATED':
    case 'SESSION_EXPIRED':
    case 'SESSION_REVOKED':
      return 401;
  }
}

export function authenticationMessage(code: AuthenticationErrorCode): string {
  return authenticationMessages[code];
}
