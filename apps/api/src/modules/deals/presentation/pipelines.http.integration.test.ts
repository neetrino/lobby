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
const rateLimit = new MemoryRateLimitRedis();

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

describe('Pipeline HTTP', () => {
  it('requires a session', async () => {
    const missing = await request(app.getHttpServer()).get('/api/v1/pipelines/lead');

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('keeps a lead card off the deal board and out of another tenant', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-a', 'ada@example.com');
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const deal = await request(http).get('/api/v1/pipelines/deal').set('Cookie', owner);
    const leadColumn = firstColumnId(lead.body);
    const created = await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: leadColumn, title: 'Ada lead', amount: 10 });
    const dealCard = await request(http)
      .post('/api/v1/pipelines/deal/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: firstColumnId(deal.body), title: 'Ada deal', amount: 20 });
    const cardId = created.body.data.columns[0].cards[0].id as string;
    const dealCardId = dealCard.body.data.columns[0].cards[0].id as string;
    const other = await login(http, 'pipe-b', 'bea@example.com');
    const hidden = await request(http)
      .patch(`/api/v1/pipelines/deal/cards/${cardId}`)
      .set('Origin', origin)
      .set('Cookie', other)
      .send({ title: 'Stolen' });
    const crossed = await request(http)
      .patch(`/api/v1/pipelines/deal/cards/${dealCardId}`)
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: leadColumn });
    const stillLead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const stillDeal = await request(http).get('/api/v1/pipelines/deal').set('Cookie', owner);

    expect(created.status).toBe(201);
    expect(dealCard.status).toBe(201);
    expect(created.body.data.columns[0].cards[0]).toMatchObject({ title: 'Ada lead', amount: 10, position: 0 });
    expect(hidden.status).toBe(404);
    expect(crossed.status).toBe(404);
    expect(stillLead.body.data.columns[0].cards).toEqual([
      expect.objectContaining({ id: cardId, title: 'Ada lead' }),
    ]);
    expect(stillDeal.body.data.columns[0].cards).toEqual([
      expect.objectContaining({ id: dealCardId, title: 'Ada deal' }),
    ]);
  }, 30_000);

  it('rejects an amount the integer column cannot store and an unknown field', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-amount', 'ada@example.com');
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const huge = await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: firstColumnId(lead.body), title: 'Huge', amount: 1_000_000_000_000 });
    const extra = await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: firstColumnId(lead.body), title: 'Ada', tenantId: 'other' });

    expect(huge.status).toBe(400);
    expect(huge.body.error.code).toBe('VALIDATION_ERROR');
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.pipelineCard.count()).toBe(0);
  }, 30_000);

  it('refuses to delete a column that still has a card', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-column', 'ada@example.com');
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const columnId = firstColumnId(lead.body);
    await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId, title: 'Ada' });
    const blocked = await request(http)
      .delete(`/api/v1/pipelines/lead/columns/${columnId}`)
      .set('Origin', origin)
      .set('Cookie', owner);
    const cardId = blocked.status === 409
      ? (await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner)).body.data.columns[0].cards[0].id as string
      : '';
    await request(http)
      .delete(`/api/v1/pipelines/lead/cards/${cardId}`)
      .set('Origin', origin)
      .set('Cookie', owner);
    const removed = await request(http)
      .delete(`/api/v1/pipelines/lead/columns/${columnId}`)
      .set('Origin', origin)
      .set('Cookie', owner);

    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PIPELINE_COLUMN_NOT_EMPTY');
    expect(removed.status).toBe(200);
    expect(removed.body.data.columns.some((column: { id: string }) => column.id === columnId)).toBe(false);
  }, 30_000);

  it('puts a moved card at the end of the destination column', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-move', 'ada@example.com');
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const sourceId = firstColumnId(lead.body);
    const destinationId = lead.body.data.columns[1]?.id as string;
    await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: destinationId, title: 'Already there' });
    const created = await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: sourceId, title: 'Moving' });
    const cardId = created.body.data.columns[0].cards[0].id as string;
    const moved = await request(http)
      .patch(`/api/v1/pipelines/lead/cards/${cardId}`)
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId: destinationId });
    const destination = moved.body.data.columns.find((column: { id: string }) => column.id === destinationId);

    expect(moved.status).toBe(200);
    expect(destination.cards.map((card: { title: string; position: number }) => [card.title, card.position])).toEqual([
      ['Already there', 0],
      ['Moving', 1],
    ]);
  }, 30_000);

  it('reads a board that registration already created and maps a repeated delete to not found', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-read', 'ada@example.com');
    const created = await prisma.pipeline.count();
    const lead = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);
    const columnId = firstColumnId(lead.body);
    const card = await request(http)
      .post('/api/v1/pipelines/lead/cards')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ columnId, title: 'Ada' });
    const cardId = card.body.data.columns[0].cards[0].id as string;
    const removed = await request(http)
      .delete(`/api/v1/pipelines/lead/cards/${cardId}`)
      .set('Origin', origin)
      .set('Cookie', owner);
    const again = await request(http)
      .delete(`/api/v1/pipelines/lead/cards/${cardId}`)
      .set('Origin', origin)
      .set('Cookie', owner);

    expect(created).toBe(2);
    expect(await prisma.pipeline.count()).toBe(created);
    expect(lead.status).toBe(200);
    expect(lead.body.data.name).toBe('Leads');
    expect(removed.status).toBe(200);
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('NOT_FOUND');
  }, 30_000);

  it('refuses board configuration from a member', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-member', 'ada@example.com');
    await prisma.user.updateMany({ data: { role: 'MEMBER' } });
    const renamed = await request(http)
      .patch('/api/v1/pipelines/lead')
      .set('Origin', origin)
      .set('Cookie', owner)
      .send({ name: 'Mine' });

    expect(renamed.status).toBe(403);
    expect(renamed.body.error.code).toBe('FORBIDDEN');
  }, 30_000);

  it('rejects the board when the deals module is disabled', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'pipe-off', 'ada@example.com');
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { subdomain: 'pipe-off' } });
    await prisma.tenantModule.update({
      where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: 'deals' } },
      data: { status: 'DISABLED' },
    });
    const blocked = await request(http).get('/api/v1/pipelines/lead').set('Cookie', owner);

    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('MODULE_DISABLED');
  }, 30_000);
});

function firstColumnId(body: { data: { columns: Array<{ id: string }> } }): string {
  const id = body.data.columns[0]?.id;
  if (id === undefined) {
    throw new Error('Board column was not created.');
  }
  return id;
}

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
