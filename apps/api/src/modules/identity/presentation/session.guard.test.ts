import { createHash } from 'node:crypto';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedTenantContext } from '../../../common/tenant/authenticated-tenant-context';
import { identityErrorCodes } from '../domain/identity.errors';
import { SESSION_REFRESH_INTERVAL_MS } from '../domain/session-policy';
import { hashSessionId, sessionKey } from '../infrastructure/session-id';
import {
  CurrentTenant,
  readAuthenticatedSession,
  tenantContextFromSession,
} from './current-session';
import {
  activate,
  clearTenantRows,
  createGuard,
  createOwner,
  httpContext,
  invoke,
  MemorySessionRedis,
  past,
  readPayload,
  RecordingCookieWriter,
  requestFor,
  rewrite,
} from './session-guard.fixtures';

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

describe('SessionGuard', () => {
  it('attaches the session user and tenant, ignoring a client tenant id', async () => {
    const redis = new MemorySessionRedis();
    const owner = await createOwner(prisma, 'acme', redis);
    const other = await prisma.tenant.create({
      data: { name: 'Other', subdomain: 'other', plan: 'STARTER' },
    });
    const response = new RecordingCookieWriter();
    const request = requestFor(owner.rawSessionId, {
      body: { tenantId: other.id },
      query: { tenantId: other.id },
      header: other.id,
    });

    await createGuard(prisma, redis).canActivate(httpContext(request, response));
    const session = readAuthenticatedSession(request);
    const tenant = tenantContextFromSession(session);

    expect(tenant).toEqual({ tenantId: owner.tenantId, userId: owner.userId, role: 'OWNER' });
    expect(session.authenticationVersion).toBe(1);
    expect(session.sessionHash).toBe(
      createHash('sha256').update(owner.rawSessionId, 'utf8').digest('hex'),
    );
    expect(JSON.stringify(request.auth)).not.toContain(owner.rawSessionId);
    expect(tenant.tenantId).not.toBe(other.id);
    expect(response.cleared).toBe(false);
  });

  it('returns 401 UNAUTHENTICATED when the cookie is missing', async () => {
    const response = new RecordingCookieWriter();
    let error: unknown;
    try {
      await createGuard(prisma, new MemorySessionRedis()).canActivate(
        httpContext({ headers: {} }, response),
      );
    } catch (caught) {
      error = caught;
    }

    expect(invoke(error)).toMatchObject({
      statusCode: 401,
      body: { error: { code: identityErrorCodes.UNAUTHENTICATED } },
    });
    expect(response.cleared).toBe(true);
  });

  it('returns 401 for idle expiry and for absolute expiry', async () => {
    const redis = new MemorySessionRedis();
    const owner = await createOwner(prisma, 'acme', redis);
    const idle = new RecordingCookieWriter();
    rewrite(redis, owner.rawSessionId, { idleExpiresAt: past() });

    const idleError = await activate(prisma, redis, owner.rawSessionId, idle);

    expect(invoke(idleError)).toMatchObject({
      statusCode: 401,
      body: { error: { code: identityErrorCodes.SESSION_EXPIRED } },
    });
    expect(idle.cleared).toBe(true);

    const again = await createOwner(prisma, 'beta', redis);
    const absolute = new RecordingCookieWriter();
    rewrite(redis, again.rawSessionId, { idleExpiresAt: past(), absoluteExpiresAt: past() });
    const absoluteError = await activate(prisma, redis, again.rawSessionId, absolute);

    expect(invoke(absoluteError)).toMatchObject({
      statusCode: 401,
      body: { error: { code: identityErrorCodes.SESSION_EXPIRED } },
    });
    expect(absolute.cleared).toBe(true);
  });

  it('does not move the absolute deadline when the session is touched', async () => {
    const redis = new MemorySessionRedis();
    const owner = await createOwner(prisma, 'acme', redis);
    const key = sessionKey(hashSessionId(owner.rawSessionId));
    const before = readPayload(redis, key);
    const seen = new Date(Date.now() - SESSION_REFRESH_INTERVAL_MS - 1_000).toISOString();
    rewrite(redis, owner.rawSessionId, { lastSeenAt: seen });

    await createGuard(prisma, redis).canActivate(
      httpContext(requestFor(owner.rawSessionId), new RecordingCookieWriter()),
    );
    const after = readPayload(redis, key);

    expect(after.absoluteExpiresAt).toBe(before.absoluteExpiresAt);
    expect(Date.parse(after.lastSeenAt)).toBeGreaterThan(Date.parse(seen));
    expect(Date.parse(after.idleExpiresAt)).toBeLessThanOrEqual(
      Date.parse(after.absoluteExpiresAt),
    );
  });

  it('fails closed when the Redis payload is malformed', async () => {
    const redis = new MemorySessionRedis();
    const owner = await createOwner(prisma, 'acme', redis);
    redis.strings.set(sessionKey(hashSessionId(owner.rawSessionId)), '{"role":"OWNER"}');
    const response = new RecordingCookieWriter();

    const error = await activate(prisma, redis, owner.rawSessionId, response);

    expect(invoke(error).statusCode).toBe(401);
    expect(response.cleared).toBe(true);
    expect(redis.strings.has(sessionKey(hashSessionId(owner.rawSessionId)))).toBe(false);
  });

  it('rejects a disabled user and an authenticationVersion mismatch', async () => {
    const redis = new MemorySessionRedis();
    const disabled = await createOwner(prisma, 'acme', redis);
    await prisma.user.update({ where: { id: disabled.userId }, data: { status: 'DISABLED' } });
    const disabledResponse = new RecordingCookieWriter();
    const disabledError = await activate(prisma, redis, disabled.rawSessionId, disabledResponse);

    expect(invoke(disabledError)).toMatchObject({
      statusCode: 401,
      body: { error: { code: identityErrorCodes.SESSION_REVOKED } },
    });
    expect(disabledResponse.cleared).toBe(true);

    const mismatched = await createOwner(prisma, 'beta', redis);
    await prisma.user.update({
      where: { id: mismatched.userId },
      data: { authenticationVersion: 4 },
    });
    const mismatchError = await activate(
      prisma,
      redis,
      mismatched.rawSessionId,
      new RecordingCookieWriter(),
    );

    expect(invoke(mismatchError)).toMatchObject({
      statusCode: 401,
      body: { error: { code: identityErrorCodes.SESSION_REVOKED } },
    });
  });

  it('rejects tenant A when the requested contact belongs to tenant B', async () => {
    const redis = new MemorySessionRedis();
    const owner = await createOwner(prisma, 'acme', redis);
    const other = await prisma.tenant.create({
      data: { name: 'Beta', subdomain: 'beta', plan: 'STARTER' },
    });
    const contact = await prisma.contact.create({ data: { tenantId: other.id, name: 'Foreign' } });
    const request = requestFor(owner.rawSessionId, {
      body: { tenantId: other.id },
      query: { tenantId: other.id },
      header: other.id,
    });
    await createGuard(prisma, redis).canActivate(httpContext(request, new RecordingCookieWriter()));
    const tenant = tenantContextFromSession(readAuthenticatedSession(request));

    await expect(new TenantProbeController(prisma).read(tenant, contact.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tenant.tenantId).toBe(owner.tenantId);
    expect(await prisma.contact.findUnique({ where: { id: contact.id } })).toMatchObject({
      tenantId: other.id,
    });
  });
});

@Controller('probe')
class TenantProbeController {
  constructor(private readonly database: PrismaClient) {}

  @Get('contacts/:contactId')
  async read(
    @CurrentTenant() tenant: AuthenticatedTenantContext,
    @Param('contactId') contactId: string,
  ) {
    const contact = await this.database.contact.findFirst({
      where: { id: contactId, tenantId: tenant.tenantId },
      select: { id: true, tenantId: true, name: true },
    });
    if (contact === null) {
      throw new NotFoundException();
    }
    return { data: contact };
  }
}
