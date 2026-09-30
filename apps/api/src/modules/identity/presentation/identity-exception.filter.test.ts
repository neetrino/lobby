import {
  BadRequestException,
  ConsoleLogger,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AuthorizationError } from '../../../common/auth/authorization';
import { ApiError, apiErrorCodes } from '../../../common/http/api-error';
import { ValidationError } from '../../../common/http/validation-error';
import { TEST_REQUEST_ID, captureException } from '../../../../test/exception-host';
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
        body: { error: { code, message, requestId: TEST_REQUEST_ID } },
      });
    }
  });

  it('maps origin and rate-limit failures to stable codes', () => {
    expect(invoke(new ApiError(apiErrorCodes.ORIGIN_REJECTED))).toEqual({
      statusCode: 403,
      body: {
        error: {
          code: apiErrorCodes.ORIGIN_REJECTED,
          message: 'The request origin is not allowed.',
          requestId: TEST_REQUEST_ID,
        },
      },
    });
    expect(invoke(new AuthorizationError())).toEqual({
      statusCode: 403,
      body: {
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action.',
          requestId: TEST_REQUEST_ID,
        },
      },
    });
    expect(invoke(new ApiError(apiErrorCodes.RATE_LIMITED))).toEqual({
      statusCode: 429,
      body: {
        error: {
          code: apiErrorCodes.RATE_LIMITED,
          message: 'Too many requests.',
          requestId: TEST_REQUEST_ID,
        },
      },
    });
  });

  it('hides internal and validation details', () => {
    const secret = 'plain-text-password';
    const logged: string[] = [];
    Logger.overrideLogger({
      log() {},
      error(message: unknown) {
        logged.push(String(message));
      },
      warn() {},
      debug() {},
      verbose() {},
      fatal() {},
    });
    let internal: { statusCode: number; body: unknown };
    let rejected: { statusCode: number; body: unknown };
    let server: { statusCode: number; body: unknown };
    try {
      internal = invoke(new Error(`PrismaClientKnownRequestError password=${secret}`));
      rejected = invoke(new BadRequestException({ issues: [{ message: secret }] }));
      server = invoke(new InternalServerErrorException(`Redis ${secret}`));
    } finally {
      Logger.overrideLogger(new ConsoleLogger());
    }

    expect(internal).toEqual({
      statusCode: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong.',
          requestId: TEST_REQUEST_ID,
        },
      },
    });
    expect(JSON.stringify(internal)).not.toContain(secret);
    expect(JSON.stringify(internal)).not.toContain('Prisma');
    expect(rejected).toMatchObject({
      statusCode: 400,
      body: { error: { code: 'REQUEST_REJECTED', requestId: TEST_REQUEST_ID } },
    });
    expect(JSON.stringify(rejected.body)).not.toContain(secret);
    const validation = invoke(new ValidationError([{ path: 'owner.password' }]));
    expect(validation).toEqual({
      statusCode: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          requestId: TEST_REQUEST_ID,
          fields: [{ path: 'owner.password' }],
        },
      },
    });
    expect(JSON.stringify(validation.body)).not.toContain(secret);
    expect(server.statusCode).toBe(500);
    expect(JSON.stringify(server.body)).not.toContain(secret);
    expect(JSON.stringify(server.body)).not.toContain('Redis');
    const transcript = logged.join('\n');
    expect(transcript).not.toContain(secret);
    expect(transcript).not.toContain('PrismaClientKnownRequestError password=');
    expect(transcript).not.toContain('Redis');
    expect(transcript).toContain(TEST_REQUEST_ID);
    expect(transcript).toContain('Unhandled exception');
    expect(transcript).toContain('InternalServerErrorException');
  });
});

function invoke(exception: unknown): { statusCode: number; body: unknown } {
  return captureException(new IdentityExceptionFilter(), exception);
}
