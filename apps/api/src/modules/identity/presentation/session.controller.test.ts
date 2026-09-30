import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedSession } from '../../../common/auth/authenticated-session';
import { AuthorizationError } from '../../../common/auth/authorization';
import { PermissionGuard } from '../../../common/authorization/permission.guard';
import { identityErrorCodes } from '../domain/identity.errors';
import type { SessionRole } from '../domain/authenticated-session';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import { permissiveAuthRateLimits } from '../infrastructure/rate-limit-config';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionCookie } from '../infrastructure/session-cookie';
import { hashSessionId, sessionKey } from '../infrastructure/session-id';
import { AuthRateLimitService } from '../application/auth-rate-limit.service';
import { SessionAccessService } from '../application/session-access.service';
import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { TerminateUserSessionsService } from '../application/terminate-user-sessions.service';
import { readAuthenticatedSession } from '../../../common/auth/current-request';
import { SessionController } from './session.controller';
import {
  clearTenantRows,
  httpContext,
  IndexedSessionRedis,
  RecordingCookieWriter,
  requestFor,
} from './session-guard.fixtures';
import { SessionGuard } from './session.guard';

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

describe('session endpoints', () => {
  it('keeps terminate-user on sessions:revoke', () => {
    const guard = new PermissionGuard(new Reflector());
    expect(() => guard.canActivate(roleContext('MEMBER'))).toThrow(AuthorizationError);
    expect(guard.canActivate(roleContext('OWNER'))).toBe(true);
    expect(guard.canActivate(roleContext('ADMIN'))).toBe(true);
  });

  it('returns the live role and tenant without the raw session id', async () => {
    const redis = new IndexedSessionRedis();
    const owner = await createUser('acme', 'OWNER');
    const opened = await openSession(redis, owner);
    const current = await principal(redis, opened.rawSessionId);
    const body = controller(redis).session(current);

    expect(body).toEqual({
      data: { user: { id: owner.userId, role: 'OWNER' }, tenant: { id: owner.tenantId } },
    });
    expect(JSON.stringify(body)).not.toContain(opened.rawSessionId);
    expect(JSON.stringify(body)).not.toContain('passwordHash');
    expect(JSON.stringify(body)).not.toContain(current.sessionHash);
  });

  it('terminates the caller sessions and clears the cookie', async () => {
    const redis = new IndexedSessionRedis();
    const owner = await createUser('acme', 'OWNER');
    const opened = await openSession(redis, owner);
    const response = new RecordingCookieWriter();

    await controller(redis).terminateAll(await principal(redis, opened.rawSessionId), response, auditRequest());

    expect(response.cleared).toBe(true);
    expect(redis.strings.has(sessionKey(hashSessionId(opened.rawSessionId)))).toBe(false);
    await expect(principal(redis, opened.rawSessionId)).rejects.toMatchObject({
      code: identityErrorCodes.SESSION_REVOKED,
    });
  });

  it('lets an owner revoke a tenant user and rejects a cross-tenant target', async () => {
    const redis = new IndexedSessionRedis();
    const owner = await createUser('acme', 'OWNER');
    const member = await addUser(owner.tenantId, 'MEMBER', 'member@acme.test');
    const outsider = await createUser('beta', 'OWNER');
    const memberSession = await openSession(redis, member);
    const outsiderSession = await openSession(redis, outsider);
    const sessions = controller(redis);
    const ownerPrincipal = await principal(redis, (await openSession(redis, owner)).rawSessionId);

    await sessions.terminateUser(ownerPrincipal, member.userId, auditRequest());
    await expect(sessions.terminateUser(ownerPrincipal, outsider.userId, auditRequest())).rejects.toMatchObject({
      code: identityErrorCodes.FORBIDDEN,
    });
    await expect(principal(redis, memberSession.rawSessionId)).rejects.toMatchObject({
      code: identityErrorCodes.SESSION_REVOKED,
    });
    expect(await principal(redis, outsiderSession.rawSessionId)).toMatchObject({ userId: outsider.userId });
  });
});

type TenantUser = { userId: string; tenantId: string; role: SessionRole };

function roleContext(role: 'OWNER' | 'ADMIN' | 'MEMBER'): ExecutionContext {
  return {
    getHandler: () => SessionController.prototype.terminateUser,
    getClass: () => SessionController,
    switchToHttp: () => ({ getRequest: () => ({ auth: { role } }) }),
  } as ExecutionContext;
}

function controller(redis: IndexedSessionRedis): SessionController {
  const sessions = new RedisSessionStore(redis, new PrismaSessionUserStore(prisma));
  return new SessionController(
    new TerminateUserSessionsService(new PrismaSessionUserStore(prisma), sessions, new AuditEventStore(prisma)),
    new SessionCookie(true),
  );
}

async function principal(redis: IndexedSessionRedis, rawSessionId: string): Promise<AuthenticatedSession> {
  const sessions = new RedisSessionStore(redis, new PrismaSessionUserStore(prisma));
  const request = requestFor(rawSessionId);
  await new SessionGuard(
    new SessionAccessService(sessions, new PrismaSessionUserStore(prisma)),
    new SessionCookie(true),
    new AuthRateLimitService(new MemoryRateLimitRedis(), permissiveAuthRateLimits()),
    new Reflector(),
  ).canActivate(httpContext(request, new RecordingCookieWriter()));
  return readAuthenticatedSession(request);
}

function auditRequest() {
  return {
    requestId: '44444444-4444-4444-8444-444444444444',
    headers: { 'user-agent': 'vitest' },
    ip: '127.0.0.1',
  };
}

function openSession(redis: IndexedSessionRedis, user: TenantUser) {
  return new RedisSessionStore(redis, new PrismaSessionUserStore(prisma)).create(
    { userId: user.userId, tenantId: user.tenantId, role: user.role, authenticationVersion: 1 },
    new Date(),
  );
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
