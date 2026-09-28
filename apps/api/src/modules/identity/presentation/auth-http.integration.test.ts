import 'reflect-metadata';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { AppModule } from '../../../app.module';
import { PRISMA_CLIENT } from '../../../common/outbox';
import { ALLOWED_ORIGINS } from '../../../common/security/allowed-origins';
import { AUTH_RATE_LIMITS, permissiveAuthRateLimits } from '../infrastructure/rate-limit-config';
import { RATE_LIMIT_REDIS } from '../infrastructure/rate-limit-redis';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import { REGISTRATION_ENABLED } from '../infrastructure/registration-config';
import { SESSION_REDIS } from '../infrastructure/session-redis';
import { clearTenantRows, IndexedSessionRedis } from './session-guard.fixtures';

const origin = 'http://localhost:3000';
const password = 'correct-horse-battery';
const sessions = new IndexedSessionRedis();
const rateLimit = new MemoryRateLimitRedis();

let app: INestApplication;
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
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.init();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await clearTenantRows(prisma);
  await prisma?.$disconnect();
});

beforeEach(async () => {
  sessions.strings.clear();
  sessions.sets.clear();
  rateLimit.counters.clear();
  await clearTenantRows(prisma);
});

describe('Nest auth HTTP', () => {
  it('registers, reads the session, then rejects the same cookie after logout', async () => {
    const http = app.getHttpServer();
    const registered = await request(http).post('/api/v1/auth/register').set('Origin', origin).send(registration('nest-shop'));
    const cookie = sessionCookie(registered.headers['set-cookie']);
    const current = await request(http).get('/api/v1/auth/session').set('Cookie', cookie);
    const loggedOut = await request(http).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', cookie);
    const rejected = await request(http).get('/api/v1/auth/session').set('Cookie', cookie);

    expect(registered.status).toBe(201);
    expect(current.status).toBe(200);
    expect(current.body).toMatchObject({ data: { user: { role: 'OWNER' }, tenant: { id: registered.body.data.tenant.id } } });
    expect(loggedOut.status).toBe(204);
    expect(rejected.status).toBe(401);
  }, 30_000);

  it('rejects a foreign Origin and a cookie revoked by terminate-all', async () => {
    const http = app.getHttpServer();
    const foreign = await request(http)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ subdomain: 'nest-shop', email: 'ada@example.com', password });
    const registered = await request(http).post('/api/v1/auth/register').set('Origin', origin).send(registration('nest-all'));
    const cookie = sessionCookie(registered.headers['set-cookie']);
    const terminated = await request(http)
      .post('/api/v1/auth/sessions/terminate-all')
      .set('Origin', origin)
      .set('Cookie', cookie);
    const rejected = await request(http).get('/api/v1/auth/session').set('Cookie', cookie);

    expect(foreign.status).toBe(403);
    expect(foreign.body).toMatchObject({ error: { code: 'ORIGIN_REJECTED' } });
    expect(terminated.status).toBe(204);
    expect(rejected.status).toBe(401);
  }, 30_000);
});

function registration(subdomain: string) {
  return {
    tenant: { name: subdomain, subdomain, plan: 'starter' },
    owner: { name: 'Ada', email: 'ada@example.com', password },
  };
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header.find((item) => item.startsWith('session=')) : header;
  const pair = value?.split(';')[0];
  if (pair === undefined || pair.length === 0) {
    throw new Error('Session cookie was not set.');
  }
  return pair;
}
