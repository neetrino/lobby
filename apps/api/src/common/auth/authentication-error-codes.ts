/** Session and credential failures any protected module can raise or map. */
export const authenticationErrorCodes = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
} as const;

export type AuthenticationErrorCode =
  (typeof authenticationErrorCodes)[keyof typeof authenticationErrorCodes];
