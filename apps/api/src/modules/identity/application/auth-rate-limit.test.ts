import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PlanEntitlementGrant } from '../../../common/modules/plan-entitlement-grant';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { ApiError, apiErrorCodes } from '../../../common/http/api-error';
import { CreateTenantService } from '../../organizations';
import { identityErrorCodes } from '../domain/identity.errors';
import { Argon2PasswordHasher } from '../infrastructure/argon2-password-hasher';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import type { AuthRateLimitConfig } from '../infrastructure/rate-limit-config';
import { PrismaLoginAccountStore } from '../infrastructure/prisma-login-account';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';
import { createRawSessionId } from '../infrastructure/session-id';
import { AuthController } from '../presentation/auth.controller';
import { loginSchema } from '../presentation/dto/login.schema';
import { registerSchema } from '../presentation/dto/register.schema';
import { IdentityExceptionFilter } from '../presentation/identity-exception.filter';
import { TEST_REQUEST_ID, captureException } from '../../../../test/exception-host';
import {
  clearTenantRows,
  createOwner,
  httpContext,
  MemorySessionRedis,
  RecordingCookieWriter,
} from '../presentation/session-guard.fixtures';
import { SessionGuard } from '../presentation/session.guard';
import { SessionAccessService } from './session-access.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { LoginService } from './login.service';
import { LogoutService } from './logout.service';
import { RegisterService } from './register.service';

const password = 'correct-horse-battery';
const email = 'ada@example.com';
const ip = '203.0.113.77';
const tight: AuthRateLimitConfig = {
  loginIp: { limit: 20, windowMs: 60_000 },
  loginAccount: { limit: 2, windowMs: 60_000 },
  registerIp: { limit: 2, windowMs: 60_000 },
  invalidSessionIp: { limit: 2, windowMs: 60_000 },
  inviteIp: { limit: 20, windowMs: 60_000 },
  inviteUser: { limit: 20, windowMs: 60_000 },
  acceptIp: { limit: 20, windowMs: 60_000 },
  passwordResetIp: { limit: 20, windowMs: 60_000 },
  passwordResetAccount: { limit: 20, windowMs: 60_000 },
  passwordResetConfirmIp: { limit: 20, windowMs: 60_000 },
  teamMessageIp: { limit: 20, windowMs: 60_000 },
  teamMessageUser: { limit: 2, windowMs: 60_000 },
};

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearTenantRows(prisma);
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await clearTenantRows(prisma);
});

describe('auth rate limits', () => {
  it('rejects the next attempt once the configured limit is reached', async () => {
    const redis = new MemoryRateLimitRedis();
    const limits = new AuthRateLimitService(redis, tight);
    await limits.consumeLogin(ip, 'acme', 'Ada@Example.com');
    await limits.consumeLogin(ip, 'acme', email);
    await limits.consumeRegister('198.51.100.10');
    await limits.consumeRegister('198.51.100.10');

    await expect(limits.consumeLogin(ip, 'acme', email)).rejects.toMatchObject({
      code: apiErrorCodes.RATE_LIMITED,
    });
    await expect(limits.consumeRegister('198.51.100.10')).rejects.toMatchObject({
      code: apiErrorCodes.RATE_LIMITED,
    });
    expect(
      [...redis.counters.keys()].filter((key) => key.startsWith('rate_limit:login:account:')),
    ).toHaveLength(1);
  });

  it('limits direct messages per user without storing the raw id or address', async () => {
    const redis = new MemoryRateLimitRedis();
    const limits = new AuthRateLimitService(redis, tight);
    const tenantId = '22222222-2222-4222-8222-222222222222';
    const userId = '11111111-1111-4111-8111-111111111111';
    await limits.consumeTeamMessage(ip, tenantId, userId);
    await limits.consumeTeamMessage(ip, tenantId, userId);

    await expect(limits.consumeTeamMessage(ip, tenantId, userId)).rejects.toMatchObject({
      code: apiErrorCodes.RATE_LIMITED,
    });
    for (const key of redis.counters.keys()) {
      expect(key.startsWith('rate_limit:team_message:')).toBe(true);
      expect(key.includes(userId)).toBe(false);
      expect(key.includes(tenantId)).toBe(false);
      expect(key.includes(ip)).toBe(false);
    }
  });

  it('returns the same result for an existing account and a missing account', async () => {
    const redis = new MemoryRateLimitRedis();
    const auth = controllerFor(redis);
    await auth.register(registration('acme', email), new RecordingCookieWriter(), { ip });
    const existing = await outcomes(auth, 'acme', email);
    const missing = await outcomes(auth, 'acme', 'missing@example.com');

    expect(existing.failures).toEqual([invalidCredentials, invalidCredentials]);
    expect(missing.failures).toEqual(existing.failures);
    expect(existing.limited).toEqual(rateLimited);
    expect(missing.limited).toEqual(existing.limited);
    for (const key of redis.counters.keys()) {
      expect(key.startsWith('rate_limit:')).toBe(true);
      expect(key.includes(email)).toBe(false);
      expect(key.includes('missing@example.com')).toBe(false);
      expect(key.includes(ip)).toBe(false);
      expect(key.includes('acme')).toBe(false);
    }
  });

  it('resets the account counter after a successful login', async () => {
    const redis = new MemoryRateLimitRedis();
    const auth = controllerFor(redis);
    await auth.register(registration('acme', email), new RecordingCookieWriter(), {
      ip: '203.0.113.78',
    });
    const caller = { ip: '203.0.113.79' };
    await rejected(
      auth.login(
        credentials('acme', email, 'wrong-password-value'),
        new RecordingCookieWriter(),
        caller,
      ),
    );

    await auth.login(credentials('acme', email), new RecordingCookieWriter(), caller);
    const again = invoke(
      await rejected(
        auth.login(
          credentials('acme', email, 'wrong-password-value'),
          new RecordingCookieWriter(),
          caller,
        ),
      ),
    );

    expect(again).toEqual(invalidCredentials);
  });

  it('limits repeated invalid session cookies from one address', async () => {
    const sessions = new MemorySessionRedis();
    const owner = await createOwner(prisma, 'acme', sessions);
    const guard = new SessionGuard(
      new SessionAccessService(new RedisSessionStore(sessions), new PrismaSessionUserStore(prisma)),
      new SessionCookie(true),
      limiter(tight),
      new Reflector(),
    );
    const missing = createRawSessionId();

    expect((await activate(guard, missing)).statusCode).toBe(401);
    expect((await activate(guard, missing)).statusCode).toBe(401);
    expect(await activate(guard, missing)).toMatchObject({
      statusCode: 429,
      body: rateLimited.body,
    });
    await expect(
      guard.canActivate(httpContext(request(owner.rawSessionId), new RecordingCookieWriter())),
    ).resolves.toBe(true);
    expect((await activate(guard, '', { headers: {} })).statusCode).toBe(401);
  });
});

const invalidCredentials = {
  statusCode: 401,
  body: {
    error: {
      code: identityErrorCodes.INVALID_CREDENTIALS,
      message: 'Invalid credentials.',
      requestId: TEST_REQUEST_ID,
    },
  },
};
const rateLimited = {
  statusCode: 429,
  body: {
    error: {
      code: apiErrorCodes.RATE_LIMITED,
      message: 'Too many requests.',
      requestId: TEST_REQUEST_ID,
    },
  },
};

function limiter(config: AuthRateLimitConfig): AuthRateLimitService {
  return new AuthRateLimitService(new MemoryRateLimitRedis(), config);
}

function controllerFor(redis: MemoryRateLimitRedis): AuthController {
  const sessions = new RedisSessionStore(new MemorySessionRedis());
  const incidents = { error() {} };
  return new AuthController(
    new RegisterService(
      new CreateTenantService(prisma, new OutboxService(), new PlanEntitlementGrant()),
      new Argon2PasswordHasher(),
      sessions,
      true,
      incidents,
    ),
    new LoginService(
      new PrismaLoginAccountStore(prisma),
      new Argon2PasswordHasher(),
      sessions,
      incidents,
    ),
    new LogoutService(sessions),
    new SessionCookie(true),
    new AuthRateLimitService(redis, tight),
  );
}

async function outcomes(auth: AuthController, subdomain: string, accountEmail: string) {
  const caller = { ip };
  const failures = [
    invoke(
      await rejected(
        auth.login(
          credentials(subdomain, accountEmail, 'wrong-password-value'),
          new RecordingCookieWriter(),
          caller,
        ),
      ),
    ),
    invoke(
      await rejected(
        auth.login(
          credentials(subdomain, accountEmail, 'wrong-password-value'),
          new RecordingCookieWriter(),
          caller,
        ),
      ),
    ),
  ];
  const limited = invoke(
    await rejected(
      auth.login(
        credentials(subdomain, accountEmail, 'wrong-password-value'),
        new RecordingCookieWriter(),
        caller,
      ),
    ),
  );
  return { failures, limited };
}

function registration(subdomain: string, ownerEmail: string) {
  return registerSchema.parse({
    tenant: { name: 'Acme', subdomain, plan: 'starter' },
    owner: { name: 'Ada', email: ownerEmail, password },
  });
}

function credentials(subdomain: string, accountEmail: string, secret = password) {
  return loginSchema.parse({ subdomain, email: accountEmail, password: secret });
}

function request(rawSessionId: string, override?: { headers: { cookie?: string } }) {
  return {
    ip,
    headers: override?.headers ?? { cookie: `session=${rawSessionId}` },
  };
}

async function activate(
  guard: SessionGuard,
  rawSessionId: string,
  override?: { headers: { cookie?: string } },
) {
  try {
    await guard.canActivate(
      httpContext(request(rawSessionId, override), new RecordingCookieWriter()),
    );
  } catch (error) {
    return invoke(error);
  }
  throw new Error('Expected the guard to reject the session.');
}

async function rejected(result: Promise<unknown>): Promise<unknown> {
  try {
    await result;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to fail.');
}

function invoke(exception: unknown): { statusCode: number; body: unknown } {
  return captureException(new IdentityExceptionFilter(), exception);
}
