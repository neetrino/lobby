import 'reflect-metadata';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { AUDIT_IP_HASH_KEY } from '../../../common/audit/audit-ip-hash';
import { AppModule } from '../../../app.module';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { configureHttpApp } from '../../../common/http/configure-http-app';
import { ALLOWED_ORIGINS } from '../../../common/security/allowed-origins';
import { AUTH_RATE_LIMITS, permissiveAuthRateLimits } from '../../identity/infrastructure/rate-limit-config';
import { RATE_LIMIT_REDIS } from '../../identity/infrastructure/rate-limit-redis';
import { MemoryRateLimitRedis } from '../../identity/infrastructure/memory-rate-limit-redis';
import { REGISTRATION_ENABLED } from '../../identity/infrastructure/registration-config';
import { SESSION_REDIS } from '../../identity/infrastructure/session-redis';
import { clearTenantRows, IndexedSessionRedis } from '../../identity/presentation/session-guard.fixtures';
import { INVITATION_TOKEN_KEY } from '../application/invite-member.service';
import { hashInvitationToken, openInvitationToken } from '../infrastructure/invitation-seal';

const origin = 'http://localhost:3000';
const password = 'correct-horse-battery';
const tokenKey = Buffer.alloc(32, 7);
const sessions = new IndexedSessionRedis();
const rateLimit = new MemoryRateLimitRedis();

let app: NestExpressApplication;
let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PRISMA_CLIENT)
    .useValue(prisma)
    .overrideProvider(SESSION_REDIS)
    .useValue(sessions)
    .overrideProvider(RATE_LIMIT_REDIS)
    .useValue(rateLimit)
    .overrideProvider(REGISTRATION_ENABLED)
    .useValue(true)
    .overrideProvider(ALLOWED_ORIGINS)
    .useValue([origin])
    .overrideProvider(AUTH_RATE_LIMITS)
    .useValue(permissiveAuthRateLimits())
    .overrideProvider(AUDIT_IP_HASH_KEY)
    .useValue('fedcba9876543210'.repeat(4))
    .overrideProvider(INVITATION_TOKEN_KEY)
    .useValue(tokenKey)
    .compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureHttpApp(app, { allowedOrigins: [origin], trustProxy: false }, { logger: false });
  await app.init();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await clearTenantRows(prisma);
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  sessions.strings.clear();
  sessions.sets.clear();
  rateLimit.counters.clear();
  await clearTenantRows(prisma);
});

describe('member invitations HTTP', () => {
  it('rejects an owner role and a second open invitation', async () => {
    const http = app.getHttpServer();
    const owner = await registerOwner(http, 'invite-guard');
    const ownerRole = await invite(http, owner, { email: 'member@example.com', role: 'OWNER' });
    const created = await invite(http, owner, { email: 'member@example.com', role: 'MEMBER' });
    const duplicate = await invite(http, owner, { email: 'member@example.com', role: 'MEMBER' });

    expect(ownerRole.status).toBe(400);
    expect(ownerRole.body.error.code).toBe('VALIDATION_ERROR');
    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('INVITATION_ALREADY_PENDING');
  }, 30_000);

  it('stores only a sealed token, accepts once, and blocks the member from inviting', async () => {
    const http = app.getHttpServer();
    const owner = await registerOwner(http, 'invite-accept');
    const created = await invite(http, owner, { email: 'member@example.com', role: 'MEMBER' });
    const invitationId = created.body.data.id as string;
    const token = await sealedToken(invitationId);
    const exchanged = await postPublic(http, '/api/v1/auth/invitations/exchange', {
      invitationId,
      token,
    });
    const accessCookie = namedCookie(exchanged.headers['set-cookie'], 'invitation_accept');
    const preview = await postCookie(http, '/api/v1/auth/invitations/preview', accessCookie, {
      invitationId,
    });
    const accepted = await postCookie(http, '/api/v1/auth/invitations/accept', accessCookie, {
      invitationId,
      name: 'Aram',
      password,
    });
    const repeated = await postCookie(http, '/api/v1/auth/invitations/accept', accessCookie, {
      invitationId,
      name: 'Aram',
      password,
    });
    const memberCookie = sessionCookie(accepted.headers['set-cookie']);
    const memberInvite = await invite(http, memberCookie, { email: 'other@example.com', role: 'MEMBER' });

    const replayed = await postPublic(http, '/api/v1/auth/invitations/exchange', {
      invitationId,
      token,
    });
    expect(exchanged.status).toBe(200);
    expect(replayed.status).toBe(400);
    expect(replayed.body.error.code).toBe('INVITATION_INVALID');
    expect(JSON.stringify(exchanged.body)).not.toContain(token);
    expect(accessCookie).not.toContain(token);
    expect(JSON.stringify(exchanged.headers['set-cookie'])).toContain('HttpOnly');
    expect(preview.status).toBe(200);
    expect(preview.body.data).toMatchObject({ email: 'member@example.com', role: 'MEMBER' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.user).toMatchObject({ role: 'MEMBER', email: 'member@example.com' });
    expect(repeated.status).toBe(400);
    expect(repeated.body.error.code).toBe('INVITATION_INVALID');
    expect(memberInvite.status).toBe(403);
    expect(memberInvite.body.error.code).toBe('FORBIDDEN');
  }, 60_000);

  it('invalidates the previous token when the invitation is resent', async () => {
    const http = app.getHttpServer();
    const owner = await registerOwner(http, 'invite-resend');
    const created = await invite(http, owner, { email: 'member@example.com', role: 'MEMBER' });
    const invitationId = created.body.data.id as string;
    const firstToken = await sealedToken(invitationId);
    const resent = await request(http)
      .post(`/api/v1/members/invitations/${invitationId}/resend`)
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ locale: 'en' });
    const nextToken = await sealedToken(invitationId);
    const stale = await postPublic(http, '/api/v1/auth/invitations/exchange', {
      invitationId,
      token: firstToken,
    });

    expect(resent.status).toBe(200);
    expect(nextToken).not.toBe(firstToken);
    expect(stale.status).toBe(400);
    expect(stale.body.error.code).toBe('INVITATION_INVALID');
  }, 30_000);
});

async function sealedToken(invitationId: string): Promise<string> {
  const row = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitationId } });
  const event = await prisma.outboxEvent.findFirstOrThrow({
    where: { aggregateId: invitationId, eventType: 'invitation.created' },
    orderBy: { createdAt: 'desc' },
  });
  const audit = await prisma.auditEvent.findFirstOrThrow({
    where: { resourceId: invitationId, action: 'invitation.created' },
  });
  const serialized = JSON.stringify(event.payload);
  const token = openInvitationToken(readCiphertext(event.payload), tokenKey);
  expect(serialized.includes(token)).toBe(false);
  expect(row.tokenHash).toBe(hashInvitationToken(token));
  expect(JSON.stringify(audit)).not.toContain('member@example.com');
  expect(audit.changes).toBeNull();
  return token;
}

function readCiphertext(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('tokenCiphertext' in payload)) {
    throw new Error('Outbox payload is missing the sealed token.');
  }
  const ciphertext = payload.tokenCiphertext;
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    throw new Error('Outbox payload is missing the sealed token.');
  }
  return ciphertext;
}

async function registerOwner(http: Parameters<typeof request>[0], subdomain: string): Promise<string> {
  const registered = await request(http)
    .post('/api/v1/auth/register')
    .set('Origin', origin)
    .send({
      tenant: { name: subdomain, subdomain, plan: 'starter' },
      owner: { name: 'Ada', email: 'ada@example.com', password },
    });
  expect(registered.status).toBe(201);
  return sessionCookie(registered.headers['set-cookie']);
}

function invite(
  http: Parameters<typeof request>[0],
  cookie: string,
  body: { email: string; role: string },
) {
  return request(http)
    .post('/api/v1/members/invitations')
    .set('Origin', origin)
    .set('Cookie', cookie)
    .send(body);
}

function postPublic(http: Parameters<typeof request>[0], path: string, body: object) {
  return request(http).post(path).set('Origin', origin).send(body);
}

function postCookie(
  http: Parameters<typeof request>[0],
  path: string,
  cookie: string,
  body: object,
) {
  return request(http).post(path).set('Origin', origin).set('Cookie', cookie).send(body);
}

function namedCookie(header: string | string[] | undefined, name: string): string {
  const values = Array.isArray(header) ? header : header === undefined ? [] : [header];
  const value = values.find((item) => item.startsWith(`${name}=`));
  const pair = value?.split(';')[0];
  if (pair === undefined || pair.length === 0) {
    throw new Error('Invitation cookie was not set.');
  }
  return pair;
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header.find((item) => item.startsWith('session=')) : header;
  const pair = value?.split(';')[0];
  if (pair === undefined || pair.length === 0) {
    throw new Error('Session cookie was not set.');
  }
  return pair;
}
