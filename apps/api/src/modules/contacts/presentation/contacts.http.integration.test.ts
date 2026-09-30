import 'reflect-metadata';
import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../../../app.module';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { configureHttpApp } from '../../../common/http/configure-http-app';
import { ALLOWED_ORIGINS } from '../../../common/security/allowed-origins';
import { AUTH_RATE_LIMITS, permissiveAuthRateLimits } from '../../identity/infrastructure/rate-limit-config';
import { RATE_LIMIT_REDIS } from '../../identity/infrastructure/rate-limit-redis';
import { MemoryRateLimitRedis } from '../../identity/infrastructure/memory-rate-limit-redis';
import { REGISTRATION_ENABLED } from '../../identity/infrastructure/registration-config';
import { SESSION_REDIS, type SessionRedisClient } from '../../identity/infrastructure/session-redis';

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
  sessions.sets.clear();
  rateLimit.counters.clear();
  await clearRows(prisma);
});

describe('Contacts HTTP', () => {
  it('creates a contact for the signed-in tenant and hides it from another tenant', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'contact-a', 'ada@example.com');
    const created = await request(http)
      .post('/api/v1/contacts')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ name: 'Ada ledger' });
    const contactId = created.body.data.id as string;
    const read = await request(http).get(`/api/v1/contacts/${contactId}`).set('Cookie', owner);
    const other = await login(http, 'contact-b', 'bea@example.com');
    const hidden = await request(http).get(`/api/v1/contacts/${contactId}`).set('Cookie', other);
    const renamed = await request(http)
      .patch(`/api/v1/contacts/${contactId}`)
      .set('Origin', origin)
      .set('Cookie', other)
      .send({ name: 'Stolen' });
    const stillOwner = await request(http).get(`/api/v1/contacts/${contactId}`).set('Cookie', owner);

    expect(created.status).toBe(201);
    expect(created.body).toEqual({ data: { id: contactId, name: 'Ada ledger' } });
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ data: { id: contactId, name: 'Ada ledger' } });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(hidden.body)).not.toContain('Ada ledger');
    expect(renamed.status).toBe(404);
    expect(renamed.body.error.code).toBe('NOT_FOUND');
    expect(stillOwner.status).toBe(200);
    expect(stillOwner.body).toEqual({ data: { id: contactId, name: 'Ada ledger' } });
  }, 30_000);

  it('returns 401 from the global filter when the controller has only SessionGuard', async () => {
    const http = app.getHttpServer();
    const missing = await request(http).get(
      '/api/v1/contacts/00000000-0000-4000-8000-000000000001',
    );

    expect(missing.status).toBe(401);
    expect(missing.body.error).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Authentication is required.',
      requestId: missing.headers['x-request-id'],
    });
  });

  it('rejects a client tenant id on create and rename', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'contact-strict', 'ada@example.com');
    const created = await request(http)
      .post('/api/v1/contacts')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ name: 'Ada ledger', tenantId: 'other-tenant' });
    const contact = await request(http)
      .post('/api/v1/contacts')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ name: 'Ada ledger' });
    const renamed = await request(http)
      .patch(`/api/v1/contacts/${contact.body.data.id as string}`)
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ name: 'Ada updated', tenantId: 'other-tenant' });

    expect(created.status).toBe(400);
    expect(created.body.error.code).toBe('VALIDATION_ERROR');
    expect(created.body.error.fields).toEqual([{ path: 'tenantId' }]);
    expect(JSON.stringify(created.body)).not.toContain('other-tenant');
    expect(renamed.status).toBe(400);
    expect(renamed.body.error.code).toBe('VALIDATION_ERROR');
    expect(renamed.body.error.fields).toEqual([{ path: 'tenantId' }]);
    expect(await prisma.contact.count()).toBe(1);
  }, 30_000);
});

async function login(
  http: Parameters<typeof request>[0],
  subdomain: string,
  email: string,
): Promise<string> {
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
  return sessionCookie(loggedIn.headers['set-cookie']);
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header.find((item) => item.startsWith('session=')) : header;
  const pair = value?.split(';')[0];
  if (pair === undefined || pair.length === 0) {
    throw new Error('Session cookie was not set.');
  }
  return pair;
}

async function clearRows(database: PrismaClient | undefined): Promise<void> {
  if (!database) {
    return;
  }
  await database.reservationStatusHistory.deleteMany();
  await database.reservationTable.deleteMany();
  await database.reservation.deleteMany();
  await database.servicePeriod.deleteMany();
  await database.restaurantTable.deleteMany();
  await database.diningArea.deleteMany();
  await database.venue.deleteMany();
  await database.outboxEvent.deleteMany();
  await database.contact.deleteMany();
  await database.user.deleteMany();
  await database.tenant.deleteMany();
}

class MemorySessionRedis implements SessionRedisClient {
  readonly strings = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
    return Promise.resolve();
  }

  replaceIfPresent(key: string, value: string): Promise<boolean> {
    if (!this.strings.has(key)) {
      return Promise.resolve(false);
    }
    this.strings.set(key, value);
    return Promise.resolve(true);
  }

  del(key: string): Promise<void> {
    this.strings.delete(key);
    this.sets.delete(key);
    return Promise.resolve();
  }

  sadd(key: string, member: string): Promise<void> {
    const members = this.sets.get(key) ?? new Set<string>();
    members.add(member);
    this.sets.set(key, members);
    return Promise.resolve();
  }

  srem(key: string, member: string): Promise<void> {
    this.sets.get(key)?.delete(member);
    return Promise.resolve();
  }

  smembers(key: string): Promise<readonly string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }
}
