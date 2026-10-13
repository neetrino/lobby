import {
  CataloguedClientError,
  type ClientErrorSpec,
} from '../../../common/auth/catalogued-client-error';

export const invitationErrorCodes = {
  INVALID: 'INVITATION_INVALID',
  EMAIL_TAKEN: 'INVITATION_EMAIL_TAKEN',
  ALREADY_PENDING: 'INVITATION_ALREADY_PENDING',
  UNAVAILABLE: 'INVITATION_UNAVAILABLE',
} as const;

export type InvitationErrorCode = (typeof invitationErrorCodes)[keyof typeof invitationErrorCodes];

const invitationCatalog = {
  [invitationErrorCodes.INVALID]: {
    message: 'This invitation is not valid.',
    statusCode: 400,
  },
  [invitationErrorCodes.EMAIL_TAKEN]: {
    message: 'An account with this email already exists.',
    statusCode: 409,
  },
  [invitationErrorCodes.ALREADY_PENDING]: {
    message: 'An invitation for this email is already pending.',
    statusCode: 409,
  },
  [invitationErrorCodes.UNAVAILABLE]: {
    message: 'Invitation delivery is not configured.',
    statusCode: 503,
  },
} as const satisfies Record<InvitationErrorCode, ClientErrorSpec>;

/** Invitation failure. The only argument is a catalog code. */
export class InvitationError extends CataloguedClientError {
  override readonly code: InvitationErrorCode;

  constructor(code: InvitationErrorCode) {
    super(code, invitationCatalog[code]);
    this.code = code;
  }
}
