import { createHash } from 'node:crypto';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PlanEntitlementGrant } from '../../../common/modules/plan-entitlement-grant';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { CreateTenantService } from '../../organizations';
import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import type { PasswordHasher } from '../domain/password-hasher';
import { SESSION_IDLE_TTL_MS } from '../domain/session-policy';
import { Argon2PasswordHasher } from '../infrastructure/argon2-password-hasher';
import type { IncidentLogger } from '../infrastructure/incident-logger';
import { PrismaLoginAccountStore } from '../infrastructure/prisma-login-account';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import {
  SessionCookie,
  type SessionCookieOptions,
  type SessionCookieWriter,
} from '../infrastructure/session-cookie';
import type { SessionRedisClient } from '../infrastructure/session-redis';
import { AuthController } from '../presentation/auth.controller';
import { IdentityExceptionFilter } from '../presentation/identity-exception.filter';
import { TEST_REQUEST_ID, captureException } from '../../../../test/exception-host';
import { registerSchema } from '../presentation/dto/register.schema';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { LoginService } from './login.service';
import { LogoutService } from './logout.service';
import { RegisterService } from './register.service';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import { permissiveAuthRateLimits } from '../infrastructure/rate-limit-config';

const password = 'correct-horse-battery';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearTenants();
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await clearTenants();
});

describe('registration', () => {
  it('creates the tenant, owner, and outbox event, stores a hash, and sets only an opaque cookie', async () => {
    const redis = new MemorySessionRedis();
    const { controller } = build(redis, true, { error() {} });
    const response = new RecordingCookieWriter();

    const body = await controller.register(registration('AcMe', 'Ada@Example.com'), response);
    const cookie = response.setCall?.value ?? '';
    const sessionHash = createHash('sha256').update(cookie, 'utf8').digest('hex');
    const storedUser = await prisma.user.findUniqueOrThrow({ where: { id: body.data.user.id } });
    const storedEvent = await prisma.outboxEvent.findFirst({
      where: { tenantId: body.data.tenant.id },
    });
    const serialized = JSON.stringify(body);

    expect(body.data.tenant.subdomain).toBe('acme');
    expect(body.data.tenant.plan).toBe('starter');
    expect(body.data.user.email).toBe('ada@example.com');
    expect(body.data.user.role).toBe('OWNER');
    expect(storedUser.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(storedUser.passwordHash).not.toBe(password);
    expect(storedEvent?.eventType).toBe('tenant.created');
    expect(response.setCall?.name).toBe('session');
    expect(response.setCall?.options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_IDLE_TTL_MS,
    });
    expect(redis.strings.has(`session:${sessionHash}`)).toBe(true);
    expect(serialized).not.toContain(password);
    expect(serialized).not.toContain(storedUser.passwordHash);
    expect(serialized).not.toContain(cookie);
    expect(serialized).not.toContain('authenticationVersion');
  });

  it('returns 409 TENANT_SUBDOMAIN_TAKEN for a duplicate subdomain', async () => {
    const { controller } = build(new MemorySessionRedis(), true, { error() {} });
    await controller.register(
      registration('taken-shop', 'ada@example.com'),
      new RecordingCookieWriter(),
    );
    const response = new RecordingCookieWriter();

    const error = await rejected(
      controller.register(registration('Taken-Shop', 'other@example.com'), response),
    );

    expect(error).toBeInstanceOf(IdentityError);
    expect(invoke(error)).toEqual({
      statusCode: 409,
      body: {
        error: {
          code: identityErrorCodes.TENANT_SUBDOMAIN_TAKEN,
          message: 'This subdomain is already taken.',
          requestId: TEST_REQUEST_ID,
        },
      },
    });
    expect(response.setCall).toBeUndefined();
    expect(await prisma.tenant.count()).toBe(1);
  });

  it('keeps the tenant when session creation fails after commit', async () => {
    const incidents = new RecordingIncidents();
    const { controller } = build(new FailingSessionRedis(), true, incidents);
    const response = new RecordingCookieWriter();

    const error = await rejected(
      controller.register(registration('session-fail', 'ada@example.com'), response),
    );
    const storedUser = await prisma.user.findFirstOrThrow({ where: { email: 'ada@example.com' } });
    const logged = incidents.messages.join(' ');

    expect(invoke(error)).toMatchObject({
      statusCode: 503,
      body: { error: { code: identityErrorCodes.ACCOUNT_CREATED_SIGN_IN_REQUIRED } },
    });
    expect(await prisma.tenant.count()).toBe(1);
    expect(storedUser.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(response.setCall).toBeUndefined();
    expect(logged).not.toContain(password);
    expect(logged).not.toContain(storedUser.passwordHash);
    expect(logged).not.toContain('super-secret-redis');
  });

  it('does not create a tenant when registration is disabled', async () => {
    const passwords: PasswordHasher = {
      hash: () => Promise.reject(new Error('hasher should not run')),
      verify: () => Promise.resolve(false),
    };
    const service = new RegisterService(
      new CreateTenantService(prisma, new OutboxService(), new PlanEntitlementGrant()),
      passwords,
      new RedisSessionStore(new MemorySessionRedis()),
      false,
      { error() {} },
    );

    await expect(
      service.register(registration('disabled-shop', 'ada@example.com')),
    ).rejects.toMatchObject({
      code: identityErrorCodes.REGISTRATION_DISABLED,
    });
    expect(await prisma.tenant.count()).toBe(0);
  });
});

function registration(subdomain: string, email: string) {
  return registerSchema.parse({
    tenant: { name: 'Acme', subdomain, plan: 'starter' },
    owner: { name: 'Ada', email, password },
  });
}

function build(redis: SessionRedisClient, enabled: boolean, incidents: IncidentLogger) {
  const sessions = new RedisSessionStore(redis);
  const service = new RegisterService(
    new CreateTenantService(prisma, new OutboxService(), new PlanEntitlementGrant()),
    new Argon2PasswordHasher(),
    sessions,
    enabled,
    incidents,
  );
  const controller = new AuthController(
    service,
    new LoginService(
      new PrismaLoginAccountStore(prisma),
      new Argon2PasswordHasher(),
      sessions,
      incidents,
    ),
    new LogoutService(sessions),
    new SessionCookie(true),
    new AuthRateLimitService(new MemoryRateLimitRedis(), permissiveAuthRateLimits()),
  );
  const caller = { ip: '203.0.113.20' };
  return {
    controller: {
      register: (body: Parameters<AuthController['register']>[0], response: SessionCookieWriter) =>
        controller.register(body, response, caller),
    },
  };
}

async function rejected(result: Promise<unknown>): Promise<unknown> {
  try {
    await result;
  } catch (error) {
    return error;
  }
  throw new Error('Expected registration to fail.');
}

function invoke(exception: unknown): { statusCode: number; body: unknown } {
  return captureException(new IdentityExceptionFilter(), exception);
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
  await prisma.tenantModule.deleteMany();
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

class RecordingIncidents implements IncidentLogger {
  readonly messages: string[] = [];

  error(message: string): void {
    this.messages.push(message);
  }
}

class MemorySessionRedis implements SessionRedisClient {
  readonly strings = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async replaceIfPresent(key: string, value: string): Promise<boolean> {
    if (!this.strings.has(key)) {
      return false;
    }
    this.strings.set(key, value);
    return true;
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

  async replaceIfPresent(): Promise<boolean> {
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
