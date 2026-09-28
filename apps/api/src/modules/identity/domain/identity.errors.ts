export const identityErrorCodes = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  FORBIDDEN: 'FORBIDDEN',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  TENANT_SUBDOMAIN_TAKEN: 'TENANT_SUBDOMAIN_TAKEN',
  ACCOUNT_CREATED_SIGN_IN_REQUIRED: 'ACCOUNT_CREATED_SIGN_IN_REQUIRED',
} as const;

export type IdentityErrorCode = (typeof identityErrorCodes)[keyof typeof identityErrorCodes];

const identityErrorMessages: Record<IdentityErrorCode, string> = {
  INVALID_CREDENTIALS: 'Invalid credentials.',
  UNAUTHENTICATED: 'Authentication is required.',
  SESSION_EXPIRED: 'The session has expired.',
  SESSION_REVOKED: 'The session is no longer valid.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  REGISTRATION_DISABLED: 'Registration is disabled.',
  TENANT_SUBDOMAIN_TAKEN: 'This subdomain is already taken.',
  ACCOUNT_CREATED_SIGN_IN_REQUIRED: 'The account was created. Sign in to continue.',
};

/** Domain failure with a stable code. The message is fixed and never includes caller data. */
export class IdentityError extends Error {
  readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode) {
    super(identityErrorMessages[code]);
    this.name = 'IdentityError';
    this.code = code;
  }
}
