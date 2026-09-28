import { createHash } from 'node:crypto';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { type ArgumentsHost } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxService } from '../../../common/outbox/outbox.service';
import { CreateTenantService } from '../../organizations';
import { identityErrorCodes } from '../domain/identity.errors';
import { SESSION_IDLE_TTL_MS } from '../domain/session-policy';
import { Argon2PasswordHasher } from '../infrastructure/argon2-password-hasher';
import type { IncidentLogger } from '../infrastructure/incident-logger';
import { PrismaLoginAccountStore } from '../infrastructure/prisma-login-account';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionCookie, type SessionCookieOptions, type SessionCookieWriter } from '../infrastructure/session-cookie';
import type { SessionRedisClient } from '../infrastructure/session-redis';
import { AuthController } from '../presentation/auth.controller';
import { loginSchema } from '../presentation/dto/login.schema';
import { IdentityExceptionFilter } from '../presentation/identity-exception.filter';
import { registerSchema } from '../presentation/dto/register.schema';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { LoginService } from './login.service';
import { LogoutService } from './logout.service';
import { RegisterService } from './register.service';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import { permissiveAuthRateLimits } from '../infrastructure/rate-limit-config';

const password = 'correct-horse-battery';
const invalidCredentials = {
  statusCode: 401,
  body: { error: { code: identityErrorCodes.INVALID_CREDENTIALS, message: 'Invalid credentials.' } },
};

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearTenants();
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await clearTenants();
});

describe('login', () => {
  it('sets a new opaque cookie and stores the current authentication version', async () => {
    const redis = new MemorySessionRedis();
    const { controller } = build(redis, { error() {} });
    const registered = await controller.register(registration('AcMe', 'Ada@Example.com'), new RecordingCookieWriter());
    await prisma.user.update({
      where: { id: registered.data.user.id },
      data: { authenticationVersion: 4 },
    });
    const response = new RecordingCookieWriter();

    const body = await controller.login(credentials('AcMe', 'Ada@Example.com'), response);
    const cookie = response.setCall?.value ?? '';
    const sessionHash = createHash('sha256').update(cookie, 'utf8').digest('hex');
    const stored = redis.strings.get(`session:${sessionHash}`) ?? '';
    const serialized = JSON.stringify(body);

    expect(body.data.user.id).toBe(registered.data.user.id);
    expect(body.data.user.email).toBe('ada@example.com');
    expect(body.data.tenant.subdomain).toBe('acme');
    expect(response.setCall?.name).toBe('session');
    expect(response.setCall?.options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_IDLE_TTL_MS,
    });
    expect(readField(stored, 'authenticationVersion')).toBe(4);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain('authenticationVersion');
    expect(serialized).not.toContain('$argon2id$');
  });

  it('returns the same error for a wrong tenant, email, or password', async () => {
    const { controller } = build(new MemorySessionRedis(), { error() {} });
    await controller.register(registration('acme', 'ada@example.com'), new RecordingCookieWriter());
    const wrongTenant = new RecordingCookieWriter();
    const wrongEmail = new RecordingCookieWriter();
    const wrongPassword = new RecordingCookieWriter();

    const tenantError = invoke(await rejected(controller.login(credentials('other-shop', 'ada@example.com'), wrongTenant)));
    const emailError = invoke(await rejected(controller.login(credentials('acme', 'other@example.com'), wrongEmail)));
    const passwordError = invoke(
      await rejected(controller.login(credentials('acme', 'ada@example.com', 'wrong-password-value'), wrongPassword)),
    );

    expect(tenantError).toEqual(invalidCredentials);
    expect(emailError).toEqual(tenantError);
    expect(passwordError).toEqual(tenantError);
    expect(wrongTenant.setCall).toBeUndefined();
    expect(wrongEmail.setCall).toBeUndefined();
    expect(wrongPassword.setCall).toBeUndefined();
  });

  it('returns the same error for a disabled user', async () => {
    const { controller } = build(new MemorySessionRedis(), { error() {} });
    const registered = await controller.register(registration('acme', 'ada@example.com'), new RecordingCookieWriter());
    await prisma.user.update({ where: { id: registered.data.user.id }, data: { status: 'DISABLED' } });
    const response = new RecordingCookieWriter();

    const error = invoke(await rejected(controller.login(credentials('acme', 'ada@example.com'), response)));

    expect(error).toEqual(invalidCredentials);
    expect(response.setCall).toBeUndefined();
  });

  it('resolves the user inside the requested tenant when the email is shared', async () => {
    const { controller } = build(new MemorySessionRedis(), { error() {} });
    const acme = await controller.register(registration('acme', 'ada@example.com'), new RecordingCookieWriter());
    const beta = await controller.register(registration('beta', 'ada@example.com'), new RecordingCookieWriter());

    const acmeLogin = await controller.login(credentials('acme', 'ada@example.com'), new RecordingCookieWriter());
    const betaLogin = await controller.login(credentials('beta', 'ada@example.com'), new RecordingCookieWriter());

    expect(acmeLogin.data.user.id).toBe(acme.data.user.id);
    expect(betaLogin.data.user.id).toBe(beta.data.user.id);
    expect(acmeLogin.data.user.id).not.toBe(betaLogin.data.user.id);
  });

  it('creates a different session id on each login', async () => {
    const redis = new MemorySessionRedis();
    const { controller } = build(redis, { error() {} });
    await controller.register(registration('acme', 'ada@example.com'), new RecordingCookieWriter());
    const first = new RecordingCookieWriter();
    const second = new RecordingCookieWriter();

    await controller.login(credentials('acme', 'ada@example.com'), first);
    await controller.login(credentials('acme', 'ada@example.com'), second);
    const firstCookie = first.setCall?.value ?? '';
    const secondCookie = second.setCall?.value ?? '';

    expect(firstCookie).not.toBe(secondCookie);
    expect(redis.strings.has(sessionKey(firstCookie))).toBe(true);
    expect(redis.strings.has(sessionKey(secondCookie))).toBe(true);
  });

  it('lets an owner sign in after registration could not store a session', async () => {
    const failed = build(new FailingSessionRedis(), { error() {} });
    await rejected(failed.controller.register(registration('session-fail', 'ada@example.com'), new RecordingCookieWriter()));
    const redis = new MemorySessionRedis();
    const { controller } = build(redis, { error() {} });
    const response = new RecordingCookieWriter();

    const body = await controller.login(credentials('session-fail', 'ada@example.com'), response);

    expect(body.data.user.email).toBe('ada@example.com');
    expect(body.data.user.role).toBe('OWNER');
    expect(response.setCall?.name).toBe('session');
    expect(redis.strings.has(sessionKey(response.setCall?.value ?? ''))).toBe(true);
  });
});

function registration(subdomain: string, email: string) {
  return registerSchema.parse({
    tenant: { name: 'Acme', subdomain, plan: 'starter' },
    owner: { name: 'Ada', email, password },
  });
}

function credentials(subdomain: string, email: string, secret = password) {
  return loginSchema.parse({ subdomain, email, password: secret });
}

function sessionKey(rawSessionId: string): string {
  return `session:${createHash('sha256').update(rawSessionId, 'utf8').digest('hex')}`;
}

function readField(payload: string, field: string): unknown {
  const parsed: unknown = JSON.parse(payload);
  if (typeof parsed !== 'object' || parsed === null || !(field in parsed)) {
    throw new Error('Session payload is missing the expected field.');
  }
  return Reflect.get(parsed, field);
}

function build(redis: SessionRedisClient, incidents: IncidentLogger) {
  const sessions = new RedisSessionStore(redis);
  const registerUser = new RegisterService(
    new CreateTenantService(prisma, new OutboxService()),
    new Argon2PasswordHasher(),
    sessions,
    true,
    incidents,
  );
  const controller = new AuthController(
    registerUser,
    new LoginService(new PrismaLoginAccountStore(prisma), new Argon2PasswordHasher(), sessions, incidents),
    new LogoutService(sessions),
    new SessionCookie(true),
    new AuthRateLimitService(new MemoryRateLimitRedis(), permissiveAuthRateLimits()),
  );
  const caller = { ip: '203.0.113.10' };
  return {
    controller: {
      register: (body: Parameters<AuthController['register']>[0], response: SessionCookieWriter) =>
        controller.register(body, response, caller),
      login: (body: Parameters<AuthController['login']>[0], response: SessionCookieWriter) =>
        controller.login(body, response, caller),
    },
  };
}

async function rejected(result: Promise<unknown>): Promise<unknown> {
  try {
    await result;
  } catch (error) {
    return error;
  }
  throw new Error('Expected login to fail.');
}

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
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as ArgumentsHost;
  new IdentityExceptionFilter().catch(exception, host);
  return state;
}

async function clearTenants(): Promise<void> {
  if (!prisma) {
    return;
  }
  await prisma.reservationStatusHistory.deleteMany();
  await prisma.reservationTable.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.servicePeriod.deleteMany();
  await prisma.restaurantTable.deleteMany();
  await prisma.diningArea.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
}

class RecordingCookieWriter implements SessionCookieWriter {
  setCall?: { name: string; value: string; options: SessionCookieOptions };

  cookie(name: string, value: string, options: SessionCookieOptions): void {
    this.setCall = { name, value, options };
  }

  clearCookie(): void {}
}

class MemorySessionRedis implements SessionRedisClient {
  readonly strings = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.strings.delete(key);
  }

  async sadd(): Promise<void> {}

  async srem(): Promise<void> {}

  async smembers(): Promise<readonly string[]> {
    return [];
  }
}

class FailingSessionRedis implements SessionRedisClient {
  async get(): Promise<string | null> {
    return null;
  }

  async set(): Promise<void> {
    throw new Error('redis down super-secret-redis');
  }

  async del(): Promise<void> {}

  async sadd(): Promise<void> {
    throw new Error('redis down super-secret-redis');
  }

  async srem(): Promise<void> {}

  async smembers(): Promise<readonly string[]> {
    return [];
  }
}
