import { BadRequestException, InternalServerErrorException, type ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ApiError, apiErrorCodes } from '../../../common/http/api-error';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { IdentityExceptionFilter } from './identity-exception.filter';

describe('IdentityExceptionFilter', () => {
  it('maps identity errors to a stable body', () => {
    const cases = [
      [identityErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid credentials.'],
      [identityErrorCodes.UNAUTHENTICATED, 401, 'Authentication is required.'],
      [identityErrorCodes.SESSION_EXPIRED, 401, 'The session has expired.'],
      [identityErrorCodes.SESSION_REVOKED, 401, 'The session is no longer valid.'],
      [identityErrorCodes.FORBIDDEN, 403, 'You do not have permission to perform this action.'],
      [identityErrorCodes.REGISTRATION_DISABLED, 403, 'Registration is disabled.'],
      [identityErrorCodes.TENANT_SUBDOMAIN_TAKEN, 409, 'This subdomain is already taken.'],
      [
        identityErrorCodes.ACCOUNT_CREATED_SIGN_IN_REQUIRED,
        503,
        'The account was created. Sign in to continue.',
      ],
      [identityErrorCodes.SERVICE_UNAVAILABLE, 503, 'The session store is unavailable.'],
    ] as const;

    for (const [code, statusCode, message] of cases) {
      expect(invoke(new IdentityError(code))).toEqual({
        statusCode,
        body: { error: { code, message } },
      });
    }
  });

  it('maps origin and rate-limit failures to stable codes', () => {
    expect(invoke(new ApiError(apiErrorCodes.ORIGIN_REJECTED))).toEqual({
      statusCode: 403,
      body: { error: { code: apiErrorCodes.ORIGIN_REJECTED, message: 'The request origin is not allowed.' } },
    });
    expect(invoke(new ApiError(apiErrorCodes.RATE_LIMITED))).toEqual({
      statusCode: 429,
      body: { error: { code: apiErrorCodes.RATE_LIMITED, message: 'Too many requests.' } },
    });
  });

  it('hides internal and validation details', () => {
    const secret = 'plain-text-password';
    const internal = invoke(new Error(`PrismaClientKnownRequestError password=${secret}`));
    const rejected = invoke(new BadRequestException({ issues: [{ message: secret }] }));
    const server = invoke(new InternalServerErrorException(`Redis ${secret}`));

    expect(internal).toEqual({
      statusCode: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } },
    });
    expect(JSON.stringify(internal)).not.toContain(secret);
    expect(JSON.stringify(internal)).not.toContain('Prisma');
    expect(rejected.statusCode).toBe(400);
    expect(JSON.stringify(rejected.body)).not.toContain(secret);
    expect(server.statusCode).toBe(500);
    expect(JSON.stringify(server.body)).not.toContain(secret);
    expect(JSON.stringify(server.body)).not.toContain('Redis');
  });
});

function invoke(exception: unknown): { statusCode: number; body: unknown } {
  const state: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
  const response = {
    status(statusCode: number) {
      state.statusCode = statusCode;
      return {
        json(body: unknown) {
          state.body = body;
        },
      };
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;

  new IdentityExceptionFilter().catch(exception, host);
  return state;
}
