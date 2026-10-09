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

const origin = 'http://localhost:3000';
const password = 'correct-horse-battery';
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

describe('dashboard HTTP', () => {
  it('aggregates the caller tenant, hides a disabled module, and honors a saved layout', async () => {
    const http = app.getHttpServer();
    const owner = await register(http, 'dash-shop');
    const created = await request(http)
      .post('/api/v1/contacts')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ name: 'Nareg Dashboard', type: 'person' });
    const board = await request(http).get('/api/v1/dashboard').set('Cookie', owner);
    const other = await register(http, 'dash-other');
    const foreign = await request(http).get('/api/v1/dashboard').set('Cookie', other);
    const saved = await request(http)
      .put('/api/v1/dashboard/layout')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({
        rangeDays: 7,
        scope: 'mine',
        widgets: ['contacts.new', 'work.contacts', 'activity', 'analytics'],
      });
    const ranged = await request(http).get('/api/v1/dashboard?range=90').set('Cookie', owner);

    expect(created.status).toBe(201);
    expect(board.status).toBe(200);
    expect(board.body.data.generatedAt).toEqual(expect.any(String));
    expect(board.body.data.failures).toEqual([]);
    expect(board.body.data.reservations).toBeUndefined();
    expect(board.body.data.reservationLoad).toBeUndefined();
    expect(
      board.body.data.activityTrend.days.some((day: { created: number | null }) => day.created === 1),
    ).toBe(true);
    expect(card(board.body, 'contacts.active')).toBe(1);
    expect(JSON.stringify(board.body)).not.toContain('deals');
    expect(JSON.stringify(foreign.body)).not.toContain('Nareg Dashboard');
    expect(card(foreign.body, 'contacts.active')).toBe(0);
    expect(saved.status).toBe(200);
    expect(saved.body.data.overview.map((item: { key: string }) => item.key)).not.toContain(
      'contacts.active',
    );
    expect(ranged.status).toBe(200);
    expect(ranged.body.data.rangeDays).toBe(90);
  }, 45_000);
});

function card(body: { data: { overview: Array<{ key: string; value: number }> } }, key: string): number {
  const found = body.data.overview.find((item) => item.key === key);
  if (found === undefined) {
    throw new Error(`Missing ${key} card.`);
  }
  return found.value;
}

async function register(http: ReturnType<NestExpressApplication['getHttpServer']>, subdomain: string) {
  const response = await request(http)
    .post('/api/v1/auth/register')
    .set('Origin', origin)
    .send({
      tenant: { name: subdomain, subdomain, plan: 'starter' },
      owner: { name: 'Ada', email: 'ada@example.com', password },
    });
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header.find((item) => item.startsWith('session=')) : header;
  const pair = value?.split(';')[0];
  if (response.status !== 201 || pair === undefined || pair.length === 0) {
    throw new Error(`Registration failed with ${response.status}.`);
  }
  return pair;
}
