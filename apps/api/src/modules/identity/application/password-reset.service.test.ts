import { openInvitationToken } from '@lobby/database';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { identityErrorCodes } from '../domain/identity.errors';
import { Argon2PasswordHasher } from '../infrastructure/argon2-password-hasher';
import { PrismaLoginAccountStore } from '../infrastructure/prisma-login-account';
import { PrismaPasswordResetStore } from '../infrastructure/prisma-password-reset';
import { hashPasswordResetToken } from '../infrastructure/password-reset-seal';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import type { SessionRedisClient } from '../infrastructure/session-redis';
import { ConfirmPasswordResetService } from './confirm-password-reset.service';
import { RequestPasswordResetService } from './request-password-reset.service';

const tokenKey = Buffer.alloc(32, 4);
const requestId = '44444444-4444-4444-8444-444444444444';
const oldPassword = 'correct-horse-battery';
const nextPassword = 'new-correct-horse';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await prisma.passwordReset.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenantModule.deleteMany();
  await prisma.tenant.deleteMany();
});

describe('password reset', () => {
  it('does not reveal a missing account', async () => {
    const { request } = services();
    await request.request({ subdomain: 'missing', email: 'ada@example.com', locale: 'en' });
    expect(await prisma.outboxEvent.count()).toBe(0);
    expect(await prisma.passwordReset.count()).toBe(0);
  });

  it('rejects every request when the seal key is not configured', async () => {
    const { request } = services(null);
    await expect(
      request.request({ subdomain: 'acme', email: 'ada@example.com', locale: 'en' }),
    ).rejects.toMatchObject({ code: identityErrorCodes.PASSWORD_RESET_UNAVAILABLE });
  });

  it('replaces the password once and retires the token', async () => {
    await createOwner();
    const { request, confirm } = services();
    await request.request({ subdomain: 'acme', email: 'ada@example.com', locale: 'hy' });
    const token = await readToken();

    await confirm.confirm({
      token,
      password: nextPassword,
      requestId,
      client: { ipHash: null, userAgent: null },
    });

    const user = await prisma.user.findFirstOrThrow({
      select: { passwordHash: true, authenticationVersion: true },
    });
    const hasher = new Argon2PasswordHasher();
    expect(await hasher.verify(user.passwordHash, nextPassword)).toBe(true);
    expect(await hasher.verify(user.passwordHash, oldPassword)).toBe(false);
    expect(user.authenticationVersion).toBe(2);
    expect(await prisma.passwordReset.count({ where: { usedAt: null } })).toBe(0);
    const audit = await prisma.auditEvent.findFirstOrThrow();
    expect(audit.action).toBe('user.password.reset');
    expect(JSON.stringify(audit)).not.toContain(nextPassword);
    expect(JSON.stringify(audit)).not.toContain(token);

    await expect(
      confirm.confirm({
        token,
        password: nextPassword,
        requestId,
        client: { ipHash: null, userAgent: null },
      }),
    ).rejects.toMatchObject({ code: identityErrorCodes.PASSWORD_RESET_INVALID });
  });
});

function services(key: Buffer | null = tokenKey) {
  const store = new PrismaPasswordResetStore(prisma, new OutboxService(), new AuditEventStore(prisma));
  return {
    request: new RequestPasswordResetService(new PrismaLoginAccountStore(prisma), store, key),
    confirm: new ConfirmPasswordResetService(store, new Argon2PasswordHasher(), quietSessions()),
  };
}

function quietSessions(): RedisSessionStore {
  const redis: SessionRedisClient = {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    replaceIfPresent: () => Promise.resolve(false),
    del: () => Promise.resolve(),
    sadd: () => Promise.resolve(),
    srem: () => Promise.resolve(),
    smembers: () => Promise.resolve([]),
  };
  return new RedisSessionStore(redis);
}

async function createOwner(): Promise<void> {
  const tenant = await prisma.tenant.create({
    data: { name: 'Acme', subdomain: 'acme', plan: 'STARTER' },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'ada@example.com',
      name: 'Ada',
      passwordHash: await new Argon2PasswordHasher().hash(oldPassword),
      role: 'OWNER',
    },
  });
}

async function readToken(): Promise<string> {
  const event = await prisma.outboxEvent.findFirstOrThrow();
  const payload = event.payload;
  if (typeof payload !== 'object' || payload === null || !('tokenCiphertext' in payload)) {
    throw new Error('Reset event is missing the seal.');
  }
  const sealed = payload.tokenCiphertext;
  if (typeof sealed !== 'string') {
    throw new Error('Reset seal is not a string.');
  }
  const token = openInvitationToken(sealed, tokenKey);
  expect(await prisma.passwordReset.findUnique({ where: { tokenHash: hashPasswordResetToken(token) } })).not.toBeNull();
  expect(JSON.stringify(payload)).not.toContain(token);
  return token;
}
