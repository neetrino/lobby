import 'reflect-metadata';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../app.module';
import { PRISMA_CLIENT } from '../database/database.tokens';
import { configureHttpApp } from '../http/configure-http-app';
import { ALLOWED_ORIGINS } from '../security/allowed-origins';
import { AUTH_RATE_LIMITS, permissiveAuthRateLimits } from '../../modules/identity/infrastructure/rate-limit-config';
import { RATE_LIMIT_REDIS } from '../../modules/identity/infrastructure/rate-limit-redis';
import { MemoryRateLimitRedis } from '../../modules/identity/infrastructure/memory-rate-limit-redis';
import { REGISTRATION_ENABLED } from '../../modules/identity/infrastructure/registration-config';
import { SESSION_REDIS, type SessionRedisClient } from '../../modules/identity/infrastructure/session-redis';
import { MemorySessionRedis } from '../../modules/identity/presentation/session-guard.fixtures';

const origin = 'http://localhost:3000';
const password = 'correct-horse-battery';

let app: NestExpressApplication;
let prisma: PrismaClient;
let sessions: MemorySessionRedis;
let rateLimit: MemoryRateLimitRedis;

beforeAll(async () => {
  sessions = new MemorySessionRedis();
  rateLimit = new MemoryRateLimitRedis();
  prisma = await createTestPrismaClient();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PRISMA_CLIENT)
    .useValue(prisma)
    .overrideProvider(SESSION_REDIS)
    .useValue(sessions satisfies SessionRedisClient)
    .overrideProvider(RATE_LIMIT_REDIS)
    .useValue(rateLimit)
    .overrideProvider(REGISTRATION_ENABLED)
    .useValue(true)
    .overrideProvider(ALLOWED_ORIGINS)
    .useValue([origin])
    .overrideProvider(AUTH_RATE_LIMITS)
    .useValue(permissiveAuthRateLimits())
    .compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureHttpApp(app, { allowedOrigins: [origin], trustProxy: false }, { logger: false });
  await app.init();
}, 60_000);

afterAll(async () => {
  await app?.close();
  await clearRows(prisma);
  await prisma?.$disconnect();
});

beforeEach(async () => {
  sessions.strings.clear();
  rateLimit.counters.clear();
  await clearRows(prisma);
});

describe('GET /api/v1/audit-events', () => {
  it('returns a tenant page and rejects an unknown query field', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'audit-a', 'ada@example.com');
    const other = await login(http, 'audit-b', 'bea@example.com');
    await insertEvent(owner.userId, owner.tenantId, '10000000-0000-4000-8000-000000000021', '2026-01-01T00:00:00.000Z');
    await insertEvent(owner.userId, owner.tenantId, '20000000-0000-4000-8000-000000000022', '2026-01-02T00:00:00.000Z');
    await insertEvent(other.userId, other.tenantId, '30000000-0000-4000-8000-000000000023', '2026-01-03T00:00:00.000Z');

    const first = await request(http).get('/api/v1/audit-events?limit=1').set('Cookie', owner.cookie);
    const cursor = first.body.page.nextCursor as string;
    const second = await request(http).get(`/api/v1/audit-events?limit=1&cursor=${encodeURIComponent(cursor)}`).set('Cookie', owner.cookie);
    const rejected = await request(http).get('/api/v1/audit-events?orderBy=id').set('Cookie', owner.cookie);
    const anonymous = await request(http).get('/api/v1/audit-events');

    expect(first.status).toBe(200);
    expect(first.body.data.map((row: { id: string }) => row.id)).toEqual(['20000000-0000-4000-8000-000000000022']);
    expect(second.status).toBe(200);
    expect(second.body.data.map((row: { id: string }) => row.id)).toEqual(['10000000-0000-4000-8000-000000000021']);
    expect(second.body.page.nextCursor).toBeNull();
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
    expect(rejected.body.error.fields).toEqual([{ path: 'orderBy' }]);
    expect(anonymous.status).toBe(401);
  }, 30_000);
});

async function login(
  http: Parameters<typeof request>[0],
  subdomain: string,
  email: string,
): Promise<{ cookie: string; userId: string; tenantId: string }> {
  const registered = await request(http)
    .post('/api/v1/auth/register')
    .set('Origin', origin)
    .send({
      tenant: { name: subdomain, subdomain, plan: 'starter' },
      owner: { name: 'Ada', email, password },
    });
  expect(registered.status).toBe(201);
  const loggedIn = await request(http)
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .send({ subdomain, email, password });
  expect(loggedIn.status).toBe(200);
  return {
    cookie: sessionCookie(loggedIn.headers['set-cookie']),
    userId: loggedIn.body.data.user.id as string,
    tenantId: loggedIn.body.data.tenant.id as string,
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

async function insertEvent(userId: string, tenantId: string, id: string, occurredAt: string): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      id,
      tenantId,
      occurredAt: new Date(occurredAt),
      actorUserId: userId,
      actorRole: 'OWNER',
      actorType: 'USER',
      action: 'user.sessions.terminated',
      resourceType: 'user',
      resourceId: userId,
      outcome: 'DENIED',
      requestId: '44444444-4444-4444-8444-444444444444',
      schemaVersion: 1,
    },
  });
}

async function clearRows(database: PrismaClient | undefined): Promise<void> {
  if (!database) {
    return;
  }
  await database.auditEvent.deleteMany();
  await database.reservationStatusHistory.deleteMany();
  await database.reservationTable.deleteMany();
  await database.reservation.deleteMany();
  await database.servicePeriod.deleteMany();
  await database.restaurantTable.deleteMany();
  await database.diningArea.deleteMany();
  await database.venue.deleteMany();
  await database.outboxEvent.deleteMany();
  await database.contact.deleteMany();
  await database.tenantModule.deleteMany();
  await database.user.deleteMany();
  await database.tenant.deleteMany();
}
