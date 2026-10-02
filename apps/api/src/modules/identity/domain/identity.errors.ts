import { authenticationCatalog } from '../../../common/auth/authentication.error';
import {
  CataloguedClientError,
  type ClientErrorSpec,
} from '../../../common/auth/catalogued-client-error';
import { authenticationErrorCodes } from '../../../common/auth/authentication-error-codes';

export const identityErrorCodes = {
  ...authenticationErrorCodes,
  FORBIDDEN: 'FORBIDDEN',
  REGISTRATION_DISABLED: 'REGISTRATION_DISABLED',
  TENANT_SUBDOMAIN_TAKEN: 'TENANT_SUBDOMAIN_TAKEN',
  ACCOUNT_CREATED_SIGN_IN_REQUIRED: 'ACCOUNT_CREATED_SIGN_IN_REQUIRED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type IdentityErrorCode = (typeof identityErrorCodes)[keyof typeof identityErrorCodes];

const identityCatalog = {
  ...authenticationCatalog,
  [identityErrorCodes.FORBIDDEN]: {
    message: 'You do not have permission to perform this action.',
    statusCode: 403,
  },
  [identityErrorCodes.REGISTRATION_DISABLED]: {
    message: 'Registration is disabled.',
    statusCode: 403,
  },
  [identityErrorCodes.TENANT_SUBDOMAIN_TAKEN]: {
    message: 'This subdomain is already taken.',
    statusCode: 409,
  },
  [identityErrorCodes.ACCOUNT_CREATED_SIGN_IN_REQUIRED]: {
    message: 'The account was created. Sign in to continue.',
    statusCode: 503,
  },
  [identityErrorCodes.SERVICE_UNAVAILABLE]: {
    message: 'The session store is unavailable.',
    statusCode: 503,
  },
} as const satisfies Record<IdentityErrorCode, ClientErrorSpec>;

/**
 * Identity failure. The only argument is a catalog code.
 * Authentication codes reuse the shared catalog. Business codes stay in this module.
 */
export class IdentityError extends CataloguedClientError {
  override readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode) {
    super(code, identityCatalog[code]);
    this.code = code;
  }
}
