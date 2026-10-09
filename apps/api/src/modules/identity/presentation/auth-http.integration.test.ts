import 'reflect-metadata';
import { openInvitationToken } from '@lobby/database';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
import { Controller, Get, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { AUDIT_IP_HASH_KEY } from '../../../common/audit/audit-ip-hash';
import { AppModule } from '../../../app.module';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { configureHttpApp } from '../../../common/http/configure-http-app';
import { ALLOWED_ORIGINS } from '../../../common/security/allowed-origins';
import { AUTH_RATE_LIMITS, permissiveAuthRateLimits } from '../infrastructure/rate-limit-config';
import { RATE_LIMIT_REDIS } from '../infrastructure/rate-limit-redis';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import { REGISTRATION_ENABLED } from '../infrastructure/registration-config';
import { SESSION_REDIS } from '../infrastructure/session-redis';
import { clearTenantRows, IndexedSessionRedis } from './session-guard.fixtures';
import {
  hashPasswordResetToken,
  PASSWORD_RESET_TOKEN_KEY,
} from '../infrastructure/password-reset-seal';

const origin = 'http://localhost:3000';
const password = 'correct-horse-battery';
const nextPassword = 'replacement-horse-battery';
const tokenKey = Buffer.alloc(32, 9);
const sessions = new IndexedSessionRedis();
const rateLimit = new MemoryRateLimitRedis();

let app: NestExpressApplication;
let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [UnmarkedProbeController],
  })
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
    .overrideProvider(PASSWORD_RESET_TOKEN_KEY)
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

describe('Nest auth HTTP', () => {
  it('reports whether public registration is open', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/registration');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { enabled: true } });
  });

  it('registers, reads the session, then rejects the same cookie after logout', async () => {
    const http = app.getHttpServer();
    const registered = await request(http)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send(registration('nest-shop'));
    const cookie = sessionCookie(registered.headers['set-cookie']);
    const current = await request(http).get('/api/v1/auth/session').set('Cookie', cookie);
    const loggedOut = await request(http)
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie);
    const rejected = await request(http).get('/api/v1/auth/session').set('Cookie', cookie);

    expect(registered.status).toBe(201);
    expect(registered.headers['x-request-id']).toEqual(expect.any(String));
    expect(registered.body.requestId).toBeUndefined();
    expect(current.status).toBe(200);
    expect(current.body).toMatchObject({
      data: { user: { role: 'OWNER' }, tenant: { id: registered.body.data.tenant.id } },
    });
    expect(loggedOut.status).toBe(204);
    expect(rejected.status).toBe(401);
  }, 30_000);

  it('rejects a foreign Origin and a cookie revoked by terminate-all', async () => {
    const http = app.getHttpServer();
    const foreign = await request(http)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ subdomain: 'nest-shop', email: 'ada@example.com', password });
    const registered = await request(http)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send(registration('nest-all'));
    const cookie = sessionCookie(registered.headers['set-cookie']);
    const terminated = await request(http)
      .post('/api/v1/auth/sessions/terminate-all')
      .set('Origin', origin)
      .set('Cookie', cookie);
    const rejected = await request(http).get('/api/v1/auth/session').set('Cookie', cookie);

    expect(foreign.status).toBe(403);
    expect(foreign.body).toMatchObject({
      error: { code: 'ORIGIN_REJECTED', requestId: foreign.headers['x-request-id'] },
    });
    expect(terminated.status).toBe(204);
    expect(rejected.status).toBe(401);
  }, 30_000);

  it('requires a session on an unmarked controller and keeps origin checks on public routes', async () => {
    const http = app.getHttpServer();
    const unmarked = await request(http).get('/api/v1/guard-probe');
    const originFirst = await request(http).post('/api/v1/guard-probe').send({});
    const health = await request(http).get('/health').set('Origin', 'https://evil.example');
    const login = await request(http)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({});
    const loggedOut = await request(http).post('/api/v1/auth/logout').set('Origin', origin);

    expect(unmarked.status).toBe(401);
    expect(unmarked.body.error).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Authentication is required.',
    });
    expect(originFirst.status).toBe(403);
    expect(originFirst.body.error.code).toBe('ORIGIN_REJECTED');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    expect(health.headers['access-control-allow-origin']).toBeUndefined();
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ORIGIN_REJECTED');
    expect(login.headers['access-control-allow-origin']).toBeUndefined();
    expect(loggedOut.status).toBe(204);
  });

  it('issues a reset through the outbox, then accepts only the new password', async () => {
    const http = app.getHttpServer();
    const missing = await postReset(http);
    expect(missing.status).toBe(204);
    expect(await resetEventCount()).toBe(0);
    const registered = await request(http)
      .post('/api/v1/auth/register')
      .set('Origin', origin)
      .send(registration('nest-reset'));
    const requested = await postReset(http);
    const token = await readResetToken();
    const confirmed = await postConfirm(http, token);
    const signedIn = await postLogin(http, nextPassword);
    const rejected = await postLogin(http, password);
    const reused = await postConfirm(http, token);

    expect(registered.status).toBe(201);
    expect(requested.status).toBe(204);
    expect(await resetEventCount()).toBe(1);
    expect(confirmed.status).toBe(204);
    expect(confirmed.headers['set-cookie']).toBeUndefined();
    expect(signedIn.status).toBe(200);
    expect(rejected.status).toBe(401);
    expect(rejected.body).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
    expect(reused.status).toBe(400);
    expect(reused.body).toMatchObject({ error: { code: 'PASSWORD_RESET_INVALID' } });
  }, 45_000);
});

@Controller('guard-probe')
class UnmarkedProbeController {
  @Get()
  read(): { data: { ok: true } } {
    return { data: { ok: true } };
  }

  @Post()
  write(): { data: { ok: true } } {
    return { data: { ok: true } };
  }
}

function registration(subdomain: string) {
  return {
    tenant: { name: subdomain, subdomain, plan: 'starter' },
    owner: { name: 'Ada', email: 'ada@example.com', password },
  };
}

function postReset(http: ReturnType<NestExpressApplication['getHttpServer']>) {
  return request(http)
    .post('/api/v1/auth/password-resets')
    .set('Origin', origin)
    .send({ subdomain: 'nest-reset', email: 'ada@example.com', locale: 'hy' });
}

function postConfirm(http: ReturnType<NestExpressApplication['getHttpServer']>, token: string) {
  return request(http)
    .post('/api/v1/auth/password-resets/confirm')
    .set('Origin', origin)
    .send({ token, password: nextPassword });
}

function postLogin(http: ReturnType<NestExpressApplication['getHttpServer']>, next: string) {
  return request(http)
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .send({ subdomain: 'nest-reset', email: 'ada@example.com', password: next });
}

function resetEventCount(): Promise<number> {
  return prisma.outboxEvent.count({ where: { eventType: 'password_reset.requested' } });
}

async function readResetToken(): Promise<string> {
  const event = await prisma.outboxEvent.findFirstOrThrow({
    where: { eventType: 'password_reset.requested' },
  });
  const payload = event.payload;
  if (typeof payload !== 'object' || payload === null || !('tokenCiphertext' in payload)) {
    throw new Error('Reset event is missing the seal.');
  }
  const sealed = payload.tokenCiphertext;
  if (typeof sealed !== 'string') {
    throw new Error('Reset seal is not a string.');
  }
  const token = openInvitationToken(sealed, tokenKey);
  expect(payload).toMatchObject({ recipientEmail: 'ada@example.com', locale: 'hy' });
  expect(JSON.stringify(payload)).not.toContain(token);
  expect(
    await prisma.passwordReset.findUnique({ where: { tokenHash: hashPasswordResetToken(token) } }),
  ).not.toBeNull();
  return token;
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header.find((item) => item.startsWith('session=')) : header;
  const pair = value?.split(';')[0];
  if (pair === undefined || pair.length === 0) {
    throw new Error('Session cookie was not set.');
  }
  return pair;
}
