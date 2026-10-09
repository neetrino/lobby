import { describe, expect, it } from 'vitest';

import { authenticationErrorCodes } from './authentication-error-codes';
import { AuthenticationError } from './authentication.error';
import { tryMapIdentityError } from '../http/map-identity-error';

describe('AuthenticationError', () => {
  it('returns the catalog payload after the error message is replaced', () => {
    const error = new AuthenticationError(authenticationErrorCodes.UNAUTHENTICATED);
    error.message = 'redis://secret WRONGPASS';

    expect(error.toClientPayload()).toEqual({
      code: authenticationErrorCodes.UNAUTHENTICATED,
      message: 'Authentication is required.',
      statusCode: 401,
    });
    expect(tryMapIdentityError(error, 'req-1')).toEqual({
      statusCode: 401,
      body: {
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication is required.',
          requestId: 'req-1',
        },
      },
    });
    expect(JSON.stringify(tryMapIdentityError(error, 'req-1'))).not.toContain('redis://');
  });
});
