import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { OutboxService } from '../../../common/outbox/outbox.service';
import { CreateTenantService } from '../../organizations';
import { identityErrorCodes } from '../domain/identity.errors';
import type { SessionRole } from '../domain/authenticated-session';
import { Argon2PasswordHasher } from '../infrastructure/argon2-password-hasher';
import type { IncidentLogger } from '../infrastructure/incident-logger';
import { PrismaLoginAccountStore } from '../infrastructure/prisma-login-account';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import { permissiveAuthRateLimits } from '../infrastructure/rate-limit-config';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore, StaleSessionError } from '../infrastructure/redis-session.store';
import { SessionCookie } from '../infrastructure/session-cookie';
import type { SessionRedisClient } from '../infrastructure/session-redis';
import { hashSessionId, sessionKey, userSessionsKey } from '../infrastructure/session-id';
import { AuthController } from '../presentation/auth.controller';
import {
  clearTenantRows,
  httpContext,
  IndexedSessionRedis,
  invoke,
  RecordingCookieWriter,
  requestFor,
} from '../presentation/session-guard.fixtures';
import { SessionGuard } from '../presentation/session.guard';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { LoginService } from './login.service';
import { LogoutService } from './logout.service';
import { RegisterService } from './register.service';
import { SessionAccessService } from './session-access.service';
import { TerminateUserSessionsService } from './terminate-user-sessions.service';

const incidents: IncidentLogger = { error() {} };

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearTenantRows(prisma);
  await prisma?.$disconnect();
});

beforeEach(async () => {
  await clearTenantRows(prisma);
});

describe('logout', () => {
  it('returns 401 for the same cookie and leaves the other device signed in', async () => {
    const redis = new IndexedSessionRedis();
    const sessions = checkedSessions(redis);
    const owner = await createUser('acme', 'OWNER');
    const current = await openSession(sessions, owner);
    const other = await openSession(sessions, owner);
    const response = new RecordingCookieWriter();

    await controllerFor(sessions).logout(requestFor(current.rawSessionId), response);
    const rejected = await rejection(redis, current.rawSessionId);
    const members = await redis.smembers(userSessionsKey(owner.userId));

    expect(response.cleared).toBe(true);
    expect(rejected.statusCode).toBe(401);
    expect(redis.strings.has(sessionKey(hashSessionId(current.rawSessionId)))).toBe(false);
    expect(members).not.toContain(hashSessionId(current.rawSessionId));
    expect(members).toContain(hashSessionId(other.rawSessionId));
    await expect(accept(redis, other.rawSessionId)).resolves.toBe(true);
  });

  it('accepts a repeated logout and a logout without a live session', async () => {
    const redis = new IndexedSessionRedis();
    const sessions = checkedSessions(redis);
    const owner = await createUser('acme', 'OWNER');
    const opened = await openSession(sessions, owner);
    const auth = controllerFor(sessions);
    const first = new RecordingCookieWriter();
    const second = new RecordingCookieWriter();
    const missing = new RecordingCookieWriter();
    const invalid = new RecordingCookieWriter();

    await auth.logout(requestFor(opened.rawSessionId), first);
    await auth.logout(requestFor(opened.rawSessionId), second);
    await auth.logout({ headers: {} }, missing);
    await auth.logout({ headers: { cookie: 'session=not-a-session' } }, invalid);

    expect(first.cleared).toBe(true);
    expect(second.cleared).toBe(true);
    expect(missing.cleared).toBe(true);
    expect(invalid.cleared).toBe(true);
  });
});

describe('terminateAllSessions', () => {
  it('revokes every session, removes the reverse index, and leaves other users signed in', async () => {
    const redis = new IndexedSessionRedis();
    const sessions = checkedSessions(redis);
    const owner = await createUser('acme', 'OWNER');
    const member = await addUser(owner.tenantId, 'MEMBER', 'member@acme.test');
    const phone = await openSession(sessions, member);
    const laptop = await openSession(sessions, member);
    const ownerSession = await openSession(sessions, owner);

    await terminator(sessions).terminateAllSessions(actor(owner), member.userId);

    expect((await rejection(redis, phone.rawSessionId)).statusCode).toBe(401);
    expect((await rejection(redis, laptop.rawSessionId)).statusCode).toBe(401);
    expect(redis.sets.has(userSessionsKey(member.userId))).toBe(false);
    expect(await versionOf(member.userId)).toBe(2);
    expect(await prisma.outboxEvent.count()).toBe(0);
    await expect(accept(redis, ownerSession.rawSessionId)).resolves.toBe(true);
    expect(await versionOf(owner.userId)).toBe(1);
  });

  it('does not change another user when permission is denied', async () => {
    const redis = new IndexedSessionRedis();
    const sessions = checkedSessions(redis);
    const owner = await createUser('acme', 'OWNER');
    const member = await addUser(owner.tenantId, 'MEMBER', 'member@acme.test');
    const outsider = await createUser('beta', 'OWNER');
    const ownerSession = await openSession(sessions, owner);
    const outsiderSession = await openSession(sessions, outsider);
    const service = terminator(sessions);

    await expect(service.terminateAllSessions(actor(member), owner.userId)).rejects.toMatchObject({
      code: identityErrorCodes.FORBIDDEN,
    });
    await expect(service.terminateAllSessions(actor(owner), outsider.userId)).rejects.toMatchObject({
      code: identityErrorCodes.FORBIDDEN,
    });

    await expect(accept(redis, ownerSession.rawSessionId)).resolves.toBe(true);
    await expect(accept(redis, outsiderSession.rawSessionId)).resolves.toBe(true);
    expect(await versionOf(owner.userId)).toBe(1);
    expect(await versionOf(outsider.userId)).toBe(1);
  });

  it('drops an old session created while termination is in progress', async () => {
    const redis = new IndexedSessionRedis();
    const sessions = checkedSessions(redis);
    const owner = await createUser('acme', 'OWNER');
    const existing = await openSession(sessions, owner);
    const escaped = redis.strings.get(sessionKey(hashSessionId(existing.rawSessionId)));
    redis.holdNextSet = true;
    const raced = sessions.create(sessionInput(owner, 1), new Date());

    await terminator(sessions).terminateAllSessions(actor(owner), owner.userId);
    redis.release();

    await expect(raced).rejects.toBeInstanceOf(StaleSessionError);
    expect((await rejection(redis, existing.rawSessionId)).statusCode).toBe(401);
    expect(redis.heldKey === null || redis.strings.has(redis.heldKey)).toBe(false);
    await expect(restoreAndReject(redis, existing.rawSessionId, escaped)).resolves.toMatchObject({
      statusCode: 401,
      body: { error: { code: identityErrorCodes.SESSION_REVOKED } },
    });
    const fresh = await openSession(sessions, owner, await versionOf(owner.userId));
    await expect(accept(redis, fresh.rawSessionId)).resolves.toBe(true);
  });
});

type TenantUser = { userId: string; tenantId: string; role: SessionRole };

function checkedSessions(redis: SessionRedisClient): RedisSessionStore {
  return new RedisSessionStore(redis, new PrismaSessionUserStore(prisma));
}

function terminator(sessions: RedisSessionStore): TerminateUserSessionsService {
  return new TerminateUserSessionsService(new PrismaSessionUserStore(prisma), sessions);
}

function actor(user: TenantUser) {
  return { userId: user.userId, tenantId: user.tenantId, role: user.role };
}

function sessionInput(user: TenantUser, authenticationVersion: number) {
  return {
    userId: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    authenticationVersion,
  };
}

function openSession(sessions: RedisSessionStore, user: TenantUser, authenticationVersion = 1) {
  return sessions.create(sessionInput(user, authenticationVersion), new Date());
}

function controllerFor(sessions: RedisSessionStore): AuthController {
  return new AuthController(
    new RegisterService(
      new CreateTenantService(prisma, new OutboxService()),
      new Argon2PasswordHasher(),
      sessions,
      true,
      incidents,
    ),
    new LoginService(new PrismaLoginAccountStore(prisma), new Argon2PasswordHasher(), sessions, incidents),
    new LogoutService(sessions),
    new SessionCookie(true),
    new AuthRateLimitService(new MemoryRateLimitRedis(), permissiveAuthRateLimits()),
  );
}

function guardFor(redis: SessionRedisClient): SessionGuard {
  const sessions = new RedisSessionStore(redis);
  return new SessionGuard(
    new SessionAccessService(sessions, new PrismaSessionUserStore(prisma)),
    new SessionCookie(true),
    new AuthRateLimitService(new MemoryRateLimitRedis(), permissiveAuthRateLimits()),
  );
}

function accept(redis: SessionRedisClient, rawSessionId: string): Promise<boolean> {
  return guardFor(redis).canActivate(httpContext(requestFor(rawSessionId), new RecordingCookieWriter()));
}

async function rejection(redis: SessionRedisClient, rawSessionId: string) {
  try {
    await accept(redis, rawSessionId);
  } catch (error) {
    return invoke(error);
  }
  throw new Error('Expected the session to be rejected.');
}

async function restoreAndReject(redis: IndexedSessionRedis, rawSessionId: string, payload: string | undefined) {
  if (payload === undefined) {
    throw new Error('Expected the original session payload.');
  }
  redis.strings.set(sessionKey(hashSessionId(rawSessionId)), payload);
  const rejected = await rejection(redis, rawSessionId);
  expect(redis.strings.has(sessionKey(hashSessionId(rawSessionId)))).toBe(false);
  return rejected;
}

async function versionOf(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { authenticationVersion: true } });
  if (user === null) {
    throw new Error('Expected the user to exist.');
  }
  return user.authenticationVersion;
}

async function createUser(subdomain: string, role: SessionRole): Promise<TenantUser> {
  const tenant = await prisma.tenant.create({ data: { name: subdomain, subdomain, plan: 'STARTER' } });
  return addUser(tenant.id, role, `${role.toLowerCase()}@${subdomain}.test`);
}

async function addUser(tenantId: string, role: SessionRole, email: string): Promise<TenantUser> {
  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      name: role,
      passwordHash: 'stored-hash',
      status: 'ACTIVE',
      role,
      authenticationVersion: 1,
    },
  });
  return { tenantId, userId: user.id, role };
}
