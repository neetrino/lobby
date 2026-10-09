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
import { clearTestTenantData } from '../../../testing/clear-test-tenant-data';
import {
  AUTH_RATE_LIMITS,
  permissiveAuthRateLimits,
} from '../../identity/infrastructure/rate-limit-config';
import { MemoryRateLimitRedis } from '../../identity/infrastructure/memory-rate-limit-redis';
import { RATE_LIMIT_REDIS } from '../../identity/infrastructure/rate-limit-redis';
import { REGISTRATION_ENABLED } from '../../identity/infrastructure/registration-config';
import {
  SESSION_REDIS,
  type SessionRedisClient,
} from '../../identity/infrastructure/session-redis';

const origin = 'http://localhost:3000';
const password = 'correct-horse-battery';

let app: NestExpressApplication;
let prisma: PrismaClient;
let sessions: MemorySessionRedis;

beforeAll(async () => {
  sessions = new MemorySessionRedis();
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
  await app?.close();
  await clearTestTenantData(prisma);
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  sessions.strings.clear();
  sessions.sets.clear();
  await clearTestTenantData(prisma);
});

describe('Reservations HTTP', () => {
  it('creates a reservation for the signed-in tenant', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'book-a', 'ada@example.com');
    const tenantId = owner.tenantId;
    const starts = new Date(Date.now() + 10 * 86_400_000);
    starts.setUTCMinutes(0, 0, 0);
    starts.setUTCHours(18);
    const location = await prisma.reservationLocation.create({
      data: { tenantId, name: 'Hall', timezone: 'UTC' },
    });
    await prisma.reservationWorkingHours.create({
      data: {
        tenantId,
        locationId: location.id,
        weekday: starts.getUTCDay(),
        opensAt: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
        closesAt: new Date(Date.UTC(1970, 0, 1, 23, 0, 0)),
      },
    });
    const table = await prisma.reservationTable.create({
      data: { tenantId, locationId: location.id, name: 'A1', minCapacity: 1, capacity: 4 },
    });
    await prisma.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: 'reservations' } },
      create: { tenantId, moduleKey: 'reservations', status: 'ENABLED' },
      update: { status: 'ENABLED' },
    });

    const created = await request(http)
      .post('/api/v1/reservations')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({
        locationId: location.id,
        startsAt: starts.toISOString(),
        durationMinutes: 60,
        guestCount: 4,
        customer: { name: 'Anna', phone: '+37400000000' },
        requestedTableId: table.id,
        source: { type: 'STAFF' },
      });
    const other = await login(http, 'book-b', 'bea@example.com');
    await prisma.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId: other.tenantId, moduleKey: 'reservations' } },
      create: { tenantId: other.tenantId, moduleKey: 'reservations', status: 'ENABLED' },
      update: { status: 'ENABLED' },
    });
    const hidden = await request(http)
      .post('/api/v1/reservations')
      .set('Origin', origin)
      .set('Cookie', other.cookie)
      .send({
        locationId: location.id,
        startsAt: starts.toISOString(),
        durationMinutes: 60,
        guestCount: 2,
        customer: { name: 'Bea', phone: '+37400000001' },
        requestedTableId: table.id,
        source: { type: 'STAFF' },
      });
    const reservationId = created.body.data.id as string;
    const secondStarts = new Date(starts.getTime() + 2 * 60 * 60 * 1000);
    const secondCreated = await request(http)
      .post('/api/v1/reservations')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({
        locationId: location.id,
        startsAt: secondStarts.toISOString(),
        durationMinutes: 60,
        guestCount: 2,
        customer: { name: 'Mariam', phone: '+37400000002' },
        requestedTableId: table.id,
        source: { type: 'PHONE' },
      });
    const read = await request(http)
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Cookie', owner.cookie);
    const locations = await request(http)
      .get('/api/v1/reservation-locations')
      .set('Cookie', owner.cookie);
    const tables = await request(http)
      .get(`/api/v1/reservation-locations/${location.id}/tables`)
      .set('Cookie', owner.cookie);
    const unavailable = await request(http)
      .get('/api/v1/reservation-availability')
      .query({
        locationId: location.id,
        startsAt: starts.toISOString(),
        durationMinutes: 60,
        guestCount: 2,
      })
      .set('Cookie', owner.cookie);
    const availableForReschedule = await request(http)
      .get('/api/v1/reservation-availability')
      .query({
        locationId: location.id,
        startsAt: starts.toISOString(),
        durationMinutes: 60,
        guestCount: 2,
        excludeReservationId: reservationId,
      })
      .set('Cookie', owner.cookie);
    const listed = await request(http)
      .get('/api/v1/reservations')
      .query({ locationId: location.id, status: 'PENDING', limit: 1 })
      .set('Cookie', owner.cookie);
    const filtered = await request(http)
      .get('/api/v1/reservations')
      .query({ tableId: table.id, search: 'anna' })
      .set('Cookie', owner.cookie);
    const nextPage = await request(http)
      .get('/api/v1/reservations')
      .query({
        locationId: location.id,
        status: 'PENDING',
        limit: 1,
        cursor: listed.body.page.nextCursor as string,
      })
      .set('Cookie', owner.cookie);
    const conflictingUpdate = await request(http)
      .patch(`/api/v1/reservations/${secondCreated.body.data.id as string}`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({ startsAt: starts.toISOString() });
    const rescheduledStarts = new Date(starts.getTime() + 4 * 60 * 60 * 1000);
    const updated = await request(http)
      .patch(`/api/v1/reservations/${reservationId}`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({ startsAt: rescheduledStarts.toISOString(), guestCount: 3, customerName: 'Anna Updated' });
    const cancelled = await request(http)
      .post(`/api/v1/reservations/${reservationId}/cancel`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({ reason: 'Customer requested cancellation' });
    const hiddenRead = await request(http)
      .get(`/api/v1/reservations/${reservationId}`)
      .set('Cookie', other.cookie);
    const otherList = await request(http)
      .get('/api/v1/reservations')
      .set('Cookie', other.cookie);
    const hiddenUpdate = await request(http)
      .patch(`/api/v1/reservations/${reservationId}`)
      .set('Origin', origin)
      .set('Cookie', other.cookie)
      .send({ guestCount: 2 });
    const historyResponse = await request(http)
      .get(`/api/v1/reservations/${reservationId}/history`)
      .set('Cookie', owner.cookie);
    const hiddenTables = await request(http)
      .get(`/api/v1/reservation-locations/${location.id}/tables`)
      .set('Cookie', other.cookie);

    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      status: 'PENDING',
      locationId: location.id,
      tableId: table.id,
      guestCount: 4,
      customerName: 'Anna',
    });
    expect(created.body.meta).toEqual({ replayed: false });
    expect(JSON.stringify(created.body)).not.toContain('+37400000000');
    expect(read.status).toBe(200);
    expect(read.body.data).toMatchObject({
      ...created.body.data,
      customerPhone: '+37400000000',
      customerEmail: null,
      customerNote: null,
      durationMinutes: 60,
      source: 'STAFF',
    });
    expect(locations.body.data).toEqual([
      { id: location.id, name: 'Hall', timezone: 'UTC', address: null, status: 'ACTIVE' },
    ]);
    expect(tables.body.data).toEqual([
      {
        id: table.id,
        locationId: location.id,
        name: 'A1',
        minCapacity: 1,
        capacity: 4,
        status: 'ACTIVE',
      },
    ]);
    expect(unavailable.body.data).toEqual({ available: false, tables: [] });
    expect(availableForReschedule.body.data).toEqual({ available: true, tables: tables.body.data });
    expect(secondCreated.status).toBe(201);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([created.body.data]);
    expect(filtered.body.data).toEqual([created.body.data]);
    expect(listed.body.page.nextCursor).toEqual(expect.any(String));
    expect(nextPage.body).toEqual({
      data: [secondCreated.body.data],
      page: { nextCursor: null },
    });
    expect(conflictingUpdate.status).toBe(409);
    expect(conflictingUpdate.body.error.code).toBe('RESERVATION_TIME_CONFLICT');
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      id: reservationId,
      startsAt: rescheduledStarts.toISOString(),
      guestCount: 3,
      customerName: 'Anna Updated',
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(hiddenUpdate.status).toBe(404);
    expect(hiddenTables.status).toBe(404);
    expect(JSON.stringify(listed.body)).not.toContain('+37400000000');
    expect(hiddenRead.status).toBe(404);
    expect(otherList.body).toEqual({ data: [], page: { nextCursor: null } });
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('RESERVATION_LOCATION_NOT_FOUND');
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.map((item: { fromStatus: string | null; toStatus: string }) => [
      item.fromStatus,
      item.toStatus,
    ])).toEqual([
      [null, 'PENDING'],
      ['PENDING', 'CANCELLED'],
    ]);
    const history = await prisma.reservationStatusHistory.findMany({
      where: { reservationId },
      orderBy: { createdAt: 'asc' },
    });
    expect(history.map((row) => [row.fromStatus, row.toStatus, row.reason])).toEqual([
      [null, 'PENDING', null],
      ['PENDING', 'CANCELLED', 'Customer requested cancellation'],
    ]);
    const auditActions = await prisma.auditEvent.findMany({
      where: { resourceId: reservationId },
      orderBy: { occurredAt: 'asc' },
      select: { action: true, changes: true, reason: true },
    });
    expect(auditActions).toEqual([
      { action: 'reservation.created', changes: null, reason: null },
      { action: 'reservation.updated', changes: null, reason: null },
      {
        action: 'reservation.status.changed',
        changes: null,
        reason: 'Customer requested cancellation',
      },
    ]);
  }, 30_000);

  it('walks confirm, arrive, seat, complete, and no-show', async () => {
    const http = app.getHttpServer();
    const owner = await login(http, 'book-flow', 'flow@example.com');
    const tenantId = owner.tenantId;
    const starts = new Date(Date.now() + 12 * 86_400_000);
    starts.setUTCMinutes(0, 0, 0);
    starts.setUTCHours(18);
    const location = await prisma.reservationLocation.create({
      data: { tenantId, name: 'Hall', timezone: 'UTC' },
    });
    await prisma.reservationWorkingHours.create({
      data: {
        tenantId,
        locationId: location.id,
        weekday: starts.getUTCDay(),
        opensAt: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
        closesAt: new Date(Date.UTC(1970, 0, 1, 23, 0, 0)),
      },
    });
    const table = await prisma.reservationTable.create({
      data: { tenantId, locationId: location.id, name: 'A1', minCapacity: 1, capacity: 4 },
    });
    await prisma.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: 'reservations' } },
      create: { tenantId, moduleKey: 'reservations', status: 'ENABLED' },
      update: { status: 'ENABLED' },
    });
    const created = await request(http)
      .post('/api/v1/reservations')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({
        locationId: location.id,
        startsAt: starts.toISOString(),
        durationMinutes: 60,
        guestCount: 2,
        customer: { name: 'Nare', phone: '+37400000009' },
        requestedTableId: table.id,
        source: { type: 'STAFF' },
      });
    const id = created.body.data.id as string;
    const skipped = await request(http)
      .post(`/api/v1/reservations/${id}/transitions/seat`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({});
    const statuses: string[] = [];
    for (const action of ['confirm', 'arrive', 'seat', 'complete'] as const) {
      const moved = await request(http)
        .post(`/api/v1/reservations/${id}/transitions/${action}`)
        .set('Origin', origin)
        .set('Cookie', owner.cookie)
        .send(action === 'confirm' ? { reason: 'Guest confirmed' } : {});
      expect(moved.status).toBe(200);
      statuses.push(moved.body.data.status as string);
    }
    const repeated = await request(http)
      .post(`/api/v1/reservations/${id}/transitions/complete`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({});
    const noShowCreated = await request(http)
      .post('/api/v1/reservations')
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({
        locationId: location.id,
        startsAt: new Date(starts.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        guestCount: 2,
        customer: { name: 'Gor', phone: '+37400000008' },
        requestedTableId: table.id,
        source: { type: 'PHONE' },
      });
    const noShowId = noShowCreated.body.data.id as string;
    await request(http)
      .post(`/api/v1/reservations/${noShowId}/transitions/confirm`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({});
    const noShow = await request(http)
      .post(`/api/v1/reservations/${noShowId}/transitions/no-show`)
      .set('Origin', origin)
      .set('Cookie', owner.cookie)
      .send({});

    expect(created.status).toBe(201);
    expect(skipped.status).toBe(409);
    expect(skipped.body.error.code).toBe('RESERVATION_INVALID_TRANSITION');
    expect(statuses).toEqual(['CONFIRMED', 'ARRIVED', 'SEATED', 'COMPLETED']);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.status).toBe('COMPLETED');
    expect(noShow.status).toBe(200);
    expect(noShow.body.data.status).toBe('NO_SHOW');
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id } });
    expect(row.confirmedAt).toBeInstanceOf(Date);
    expect(row.arrivedAt).toBeInstanceOf(Date);
    expect(row.seatedAt).toBeInstanceOf(Date);
    expect(row.completedAt).toBeInstanceOf(Date);
    const history = await prisma.reservationStatusHistory.findMany({
      where: { reservationId: id },
      orderBy: { createdAt: 'asc' },
    });
    expect(history).toHaveLength(5);
    expect(history.map((item) => [item.fromStatus, item.toStatus, item.reason])).toEqual([
      [null, 'PENDING', null],
      ['PENDING', 'CONFIRMED', 'Guest confirmed'],
      ['CONFIRMED', 'ARRIVED', null],
      ['ARRIVED', 'SEATED', null],
      ['SEATED', 'COMPLETED', null],
    ]);
  }, 30_000);

  it('requires a session', async () => {
    const missing = await request(app.getHttpServer()).post('/api/v1/reservations').set('Origin', origin).send({});
    expect(missing.status).toBe(401);
  });
});

async function login(http: Parameters<typeof request>[0], subdomain: string, email: string) {
  const registered = await request(http)
    .post('/api/v1/auth/register')
    .set('Origin', origin)
    .send({ tenant: { name: subdomain, subdomain, plan: 'starter' }, owner: { name: 'Ada', email, password } });
  expect(registered.status).toBe(201);
  const loggedIn = await request(http)
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .send({ subdomain, email, password });
  expect(loggedIn.status).toBe(200);
  return { cookie: sessionCookie(loggedIn.headers['set-cookie']), tenantId: registered.body.data.tenant.id as string };
}

function sessionCookie(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header.find((item) => item.startsWith('session=')) : header;
  const pair = value?.split(';')[0];
  if (pair === undefined || pair.length === 0) {
    throw new Error('Session cookie was not set.');
  }
  return pair;
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
    if (!this.strings.has(key)) return Promise.resolve(false);
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
