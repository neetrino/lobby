import 'reflect-metadata';
import {
  createTestPrismaClient,
  disposeTestPrismaClient,
  type PrismaClient,
} from '@lobby/database/testing';
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
import { SESSION_REDIS } from '../../identity/infrastructure/session-redis';
import { clearTenantRows, IndexedSessionRedis } from '../../identity/presentation/session-guard.fixtures';

const origin = 'http://localhost:3000';
const password = 'correct-horse-battery';

let app: NestExpressApplication;
let prisma: PrismaClient;
const sessions = new IndexedSessionRedis();

beforeAll(async () => {
  prisma = await createTestPrismaClient();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PRISMA_CLIENT)
    .useValue(prisma)
    .overrideProvider(SESSION_REDIS)
    .useValue(sessions)
    .overrideProvider(RATE_LIMIT_REDIS)
    .useValue(new MemoryRateLimitRedis())
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
  await app.close();
  await clearTenantRows(prisma);
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  sessions.strings.clear();
  sessions.sets.clear();
  await clearTenantRows(prisma);
});

describe('pipeline card details', () => {
  it('reorders a card inside its column and records the deletion', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-order', 'ada@example.com');
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const columnId = lead.body.data.columns[0].id as string;
    await request(http).post('/api/v1/pipelines/lead/cards').set('Origin', origin).set('Cookie', owner).send({ columnId, title: 'First' });
    const second = await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId, title: 'Second' });
    const cards = second.body.data.columns[0].cards as Array<{ id: string; title: string }>;
    const first = cards.find((card) => card.title === 'First');
    const moved = await request(http)
      .patch(`/api/v1/pipelines/lead/cards/${first?.id}`)
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ position: 1 });
    const removed = await request(http)
      .delete(`/api/v1/pipelines/lead/cards/${first?.id}`)
      .set('Origin', origin)
      .set('Cookie', owner);

    const order = moved.body.data.columns[0].cards.map((card: { title: string }) => card.title);
    expect(order).toEqual(['Second', 'First']);
    expect(removed.status).toBe(200);
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'pipeline.card.deleted' } });
    const event = await prisma.outboxEvent.findFirst({ where: { eventType: 'pipeline.changed' } });
    expect(audit?.resourceType).toBe('lead');
    expect(event?.payload).toMatchObject({ kind: 'lead', change: 'deleted' });
  }, 30_000);

  it('compacts positions after a move or delete and audits an amount change', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-compact', 'ada@example.com');
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const sourceId = lead.body.data.columns[0].id as string;
    const destinationId = lead.body.data.columns[1].id as string;
    for (const title of ['A', 'B', 'C']) {
      await request(http)
        .post('/api/v1/pipelines/lead/cards')
        .set('Origin', origin)
        .set('Cookie', owner)
        .send({ columnId: sourceId, title });
    }
    const listed = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const sourceCards = listed.body.data.columns[0].cards as Array<{ id: string; title: string }>;
    const middle = sourceCards.find((card) => card.title === 'B');
    const first = sourceCards.find((card) => card.title === 'A');
    const moved = await request(http)
      .patch(`/api/v1/pipelines/lead/cards/${middle?.id}`)
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: destinationId });
    const priced = await request(http)
      .patch(`/api/v1/pipelines/lead/cards/${middle?.id}`)
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ amount: 20 });
    const removed = await request(http)
      .delete(`/api/v1/pipelines/lead/cards/${first?.id}`)
      .set('Origin', origin)
      .set('Cookie', owner);
    const source = columnCards(moved.body, sourceId);
    const afterDelete = columnCards(removed.body, sourceId);

    expect(moved.status).toBe(200);
    expect(source.map((card) => [card.title, card.position])).toEqual([['A', 0], ['C', 1]]);
    expect(priced.status).toBe(200);
    expect(afterDelete.map((card) => [card.title, card.position])).toEqual([['C', 0]]);
    const audit = await prisma.auditEvent.findFirst({ where: { action: 'pipeline.card.updated' } });
    expect(audit?.resourceType).toBe('lead');
  }, 30_000);

  it('hides lead routes when the account turns leads off', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-hide', 'ada@example.com');
    await prisma.user.updateMany({ data: { leadsEnabled: false } });
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const deal = await request(http).get('/api/v1/pipelines/deal').set('Cookie', owner);

    expect(lead.status).toBe(403);
    expect(lead.body.error.code).toBe('LEADS_DISABLED');
    expect(deal.status).toBe(200);
  }, 30_000);
});

function columnCards(
  body: { data: { columns: Array<{ id: string; cards: Array<{ title: string; position: number }> }> } },
  columnId: string,
): Array<{ title: string; position: number }> {
  return body.data.columns.find((column) => column.id === columnId)?.cards ?? [];
}

async function login(http: Parameters<typeof request>[0], subdomain: string, email: string): Promise<string> {
  const registered = await request(http).post('/api/v1/auth/register').set('Origin', origin).send({
    tenant: { name: subdomain, subdomain, plan: 'starter' },
    owner: { name: 'Ada', email, password },
  });
  expect(registered.status).toBe(201);
  const loggedIn = await request(http).post('/api/v1/auth/login').set('Origin', origin).send({ subdomain, email, password });
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
