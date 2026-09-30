import {
  authenticationMessage,
  authenticationStatus,
  AuthenticationError,
} from '../../../common/auth/authentication.error';
import {
  authenticationErrorCodes,
  isAuthenticationErrorCode,
} from '../../../common/auth/authentication-error-codes';

export const identityErrorCodes = {
  ...authenticationErrorCodes,
  FORBIDDEN: 'FORBIDDEN',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  TENANT_SUBDOMAIN_TAKEN: 'TENANT_SUBDOMAIN_TAKEN',
  ACCOUNT_CREATED_SIGN_IN_REQUIRED: 'ACCOUNT_CREATED_SIGN_IN_REQUIRED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type IdentityErrorCode = (typeof identityErrorCodes)[keyof typeof identityErrorCodes];

const businessMessages = {
  FORBIDDEN: 'You do not have permission to perform this action.',
  REGISTRATION_DISABLED: 'Registration is disabled.',
  TENANT_SUBDOMAIN_TAKEN: 'This subdomain is already taken.',
  ACCOUNT_CREATED_SIGN_IN_REQUIRED: 'The account was created. Sign in to continue.',
  SERVICE_UNAVAILABLE: 'The session store is unavailable.',
} as const;

type BusinessIdentityCode = keyof typeof businessMessages;

/** Identity failure. Authentication codes come from the shared contract. */
export class IdentityError extends AuthenticationError {
  override readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode) {
    super(code, messageFor(code), statusFor(code));
    this.name = 'IdentityError';
    this.code = code;
  }
}

function messageFor(code: IdentityErrorCode): string {
  if (isAuthenticationErrorCode(code)) {
    return authenticationMessage(code);
  }
  return businessMessages[code];
}

function statusFor(code: IdentityErrorCode): number {
  if (isAuthenticationErrorCode(code)) {
    return authenticationStatus(code);
  }
  return businessStatus(code);
}

function businessStatus(code: BusinessIdentityCode): number {
  switch (code) {
    case 'FORBIDDEN':
    case 'REGISTRATION_DISABLED':
      return 403;
    case 'TENANT_SUBDOMAIN_TAKEN':
      return 409;
    case 'ACCOUNT_CREATED_SIGN_IN_REQUIRED':
    case 'SERVICE_UNAVAILABLE':
      return 503;
  }
}
