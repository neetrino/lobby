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
import { encodeCursor } from '../../../common/pagination';
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
const missingUser = '00000000-0000-4000-8000-000000000099';

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

describe('Team HTTP', () => {
  it('rejects a missing session', async () => {
    const http = app.getHttpServer();
    const directory = await request(http).get('/api/v1/team');
    const messages = await request(http).get(`/api/v1/team/members/${missingUser}/messages`);
    const sent = await request(http).post(`/api/v1/team/members/${missingUser}/messages`).set('Origin', origin).send({ body: 'Hi' });

    expect(directory.status).toBe(401);
    expect(messages.status).toBe(401);
    expect(sent.status).toBe(401);
  });

  it('hides a disabled user and lets only an admin set a profession', async () => {
    const http = app.getHttpServer();
    const company = await openCompany(http, 'team-roles');
    await prisma.user.update({ where: { id: company.member.id }, data: { status: 'DISABLED' } });
    const directory = await request(http).get('/api/v1/team').set('Cookie', company.adminCookie);
    const saved = await request(http)
      .patch(`/api/v1/team/members/${company.admin.id}`)
      .set('Origin', origin)
      .set('Cookie', company.adminCookie)
      .send({ jobTitle: 'Organizer' });
    const denied = await request(http)
      .patch(`/api/v1/team/members/${company.admin.id}`)
      .set('Origin', origin)
      .set('Cookie', company.owner)
      .send({ jobTitle: 'Owner title' });
    const memberDenied = await loginMemberDenied(http, company);

    expect(directory.status).toBe(200);
    expect(directory.body.data.members.map((item: { email: string }) => item.email)).toEqual([
      'ada@example.com',
      'cam@example.com',
    ]);
    expect(saved.status).toBe(200);
    expect(saved.body.data.jobTitle).toBe('Organizer');
    expect(denied.status).toBe(200);
    expect(memberDenied.status).toBe(403);
  }, 30_000);

  it('rejects an empty or oversized profession and message', async () => {
    const http = app.getHttpServer();
    const company = await openCompany(http, 'team-validate');
    const blankTitle = await patchTitle(http, company.owner, company.member.id, '');
    const longTitle = await patchTitle(http, company.owner, company.member.id, 'x'.repeat(81));
    const blankMessage = await postMessage(http, company.owner, company.member.id, '   ');
    const longMessage = await postMessage(http, company.owner, company.member.id, 'x'.repeat(2001));
    const accepted = await postMessage(http, company.owner, company.member.id, 'x'.repeat(2000));

    expect(blankTitle.status).toBe(400);
    expect(longTitle.status).toBe(400);
    expect(blankMessage.status).toBe(400);
    expect(longMessage.status).toBe(400);
    expect(accepted.status).toBe(201);
  }, 30_000);

  it('pages through history so the newest message stays on the first page', async () => {
    const http = app.getHttpServer();
    const company = await openCompany(http, 'team-pages');
    await seedThread(company.ownerUserId, company.member.id, 201);
    const first = await request(http)
      .get(`/api/v1/team/members/${company.member.id}/messages`)
      .query({ limit: 100 })
      .set('Cookie', company.owner);
    const pages = [first.body.data as Array<{ body: string }>];
    let cursor = first.body.page.nextCursor as string | null;
    while (cursor !== null) {
      const older = await request(http)
        .get(`/api/v1/team/members/${company.member.id}/messages`)
        .query({ limit: 100, cursor })
        .set('Cookie', company.owner);
      expect(older.body.page.syncCursor).toBeNull();
      pages.push(older.body.data as Array<{ body: string }>);
      cursor = older.body.page.nextCursor as string | null;
    }
    const chronological = pages.slice().reverse().flat().map((message) => message.body);

    expect(first.status).toBe(200);
    expect(typeof first.body.page.syncCursor).toBe('string');
    expect(first.body.data.at(-1).body).toBe('m201');
    expect(chronological).toHaveLength(201);
    expect(chronological[0]).toBe('m1');
    expect(chronological.at(-1)).toBe('m201');
  }, 30_000);

  it('keeps a thread private to the two people', async () => {
    const http = app.getHttpServer();
    const company = await openCompany(http, 'team-private');
    const sent = await postMessage(http, company.owner, company.member.id, 'Hello Bea');
    const seen = await request(http).get(`/api/v1/team/members/${company.ownerUserId}/messages`).set('Cookie', company.memberCookie);
    const outsider = await request(http).get(`/api/v1/team/members/${company.member.id}/messages`).set('Cookie', company.adminCookie);
    const self = await postMessage(http, company.owner, company.ownerUserId, 'Hello me');
    const other = await login(http, 'team-other', 'dee@example.com');
    const hidden = await postMessage(http, other, company.member.id, 'Wrong company');

    expect(sent.status).toBe(201);
    expect(seen.body.data).toEqual([expect.objectContaining({ body: 'Hello Bea', authorName: 'Ada' })]);
    expect(seen.body.page.nextCursor).toBeNull();
    expect(outsider.body.data).toEqual([]);
    expect(self.status).toBe(400);
    expect(hidden.status).toBe(404);
  }, 30_000);

  it('walks every message newer than after', async () => {
    const http = app.getHttpServer();
    const company = await openCompany(http, 'team-after');
    await seedThread(company.ownerUserId, company.member.id, 5);
    const rows = await prisma.directMessage.findMany({
      where: { authorUserId: company.ownerUserId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });
    const after = encodeCursor({
      createdAt: rows[1]?.createdAt.toISOString() ?? '',
      id: rows[1]?.id ?? missingUser,
      memberId: company.member.id,
    });
    const first = await request(http)
      .get(`/api/v1/team/members/${company.member.id}/messages`)
      .query({ limit: 2, after })
      .set('Cookie', company.owner);
    const both = await request(http)
      .get(`/api/v1/team/members/${company.member.id}/messages`)
      .query({ after, cursor: after })
      .set('Cookie', company.owner);
    const rest = await request(http)
      .get(`/api/v1/team/members/${company.member.id}/messages`)
      .query({ limit: 2, after: first.body.page.syncCursor })
      .set('Cookie', company.owner);

    expect(first.status).toBe(200);
    expect(first.body.data.map((message: { body: string }) => message.body)).toEqual(['m3', 'm4']);
    expect(typeof first.body.page.syncCursor).toBe('string');
    expect(both.status).toBe(400);
    expect(rest.body.data.map((message: { body: string }) => message.body)).toEqual(['m5']);
    expect(rest.body.page.nextCursor).toBeNull();
    expect(typeof rest.body.page.syncCursor).toBe('string');
  }, 30_000);
});

async function loginMemberDenied(http: Parameters<typeof request>[0], company: OpenCompany) {
  const active = await addCoworker('MEMBER', 'bea-live@example.com', 'Bea Live', null);
  const cookie = await signIn(http, 'team-roles', active.email);
  return request(http).patch(`/api/v1/team/members/${company.admin.id}`).set('Origin', origin).set('Cookie', cookie).send({ jobTitle: 'Nope' });
}

type OpenCompany = {
  owner: string;
  ownerUserId: string;
  adminCookie: string;
  memberCookie: string;
  admin: { id: string };
  member: { id: string };
};

async function openCompany(http: Parameters<typeof request>[0], subdomain: string): Promise<OpenCompany> {
  const owner = await login(http, subdomain, 'ada@example.com');
  const ownerUser = await prisma.user.findFirstOrThrow({ where: { email: 'ada@example.com', tenant: { subdomain } } });
  const member = await addCoworker('MEMBER', 'bea@example.com', 'Bea', 'Designer');
  const admin = await addCoworker('ADMIN', 'cam@example.com', 'Cam', null);
  return {
    owner,
    ownerUserId: ownerUser.id,
    adminCookie: await signIn(http, subdomain, 'cam@example.com'),
    memberCookie: await signIn(http, subdomain, 'bea@example.com'),
    admin,
    member,
  };
}

function patchTitle(http: Parameters<typeof request>[0], cookie: string, userId: string, jobTitle: string) {
  return request(http).patch(`/api/v1/team/members/${userId}`).set('Origin', origin).set('Cookie', cookie).send({ jobTitle });
}

function postMessage(http: Parameters<typeof request>[0], cookie: string, userId: string, body: string) {
  return request(http).post(`/api/v1/team/members/${userId}/messages`).set('Origin', origin).set('Cookie', cookie).send({ body });
}

async function seedThread(ownerId: string, memberId: string, count: number): Promise<void> {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
  const [userLowId, userHighId] = ownerId < memberId ? [ownerId, memberId] : [memberId, ownerId];
  const conversation = await prisma.directConversation.create({
    data: { tenantId: owner.tenantId, userLowId, userHighId },
  });
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  await prisma.directMessage.createMany({
    data: Array.from({ length: count }, (_, index) => ({
      tenantId: owner.tenantId,
      conversationId: conversation.id,
      authorUserId: ownerId,
      body: `m${index + 1}`,
      createdAt: new Date(start + index * 1000),
    })),
  });
}

async function addCoworker(role: 'ADMIN' | 'MEMBER', email: string, name: string, jobTitle: string | null) {
  const owner = await prisma.user.findFirstOrThrow({ where: { email: 'ada@example.com' } });
  return prisma.user.create({
    data: { tenantId: owner.tenantId, email, name, passwordHash: owner.passwordHash, role, jobTitle },
  });
}

async function login(http: Parameters<typeof request>[0], subdomain: string, email: string): Promise<string> {
  const registered = await request(http).post('/api/v1/auth/register').set('Origin', origin).send({
    tenant: { name: subdomain, subdomain, plan: 'starter' },
    owner: { name: 'Ada', email, password },
  });
  expect(registered.status).toBe(201);
  return signIn(http, subdomain, email);
}

async function signIn(http: Parameters<typeof request>[0], subdomain: string, email: string): Promise<string> {
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
