import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };
import { type ArgumentsHost, type ExecutionContext } from '@nestjs/common';

import { SessionAccessService } from '../application/session-access.service';
import { IdentityExceptionFilter } from './identity-exception.filter';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionCookie, type SessionCookieWriter } from '../infrastructure/session-cookie';
import type { SessionRedisClient } from '../infrastructure/session-redis';
import { hashSessionId, sessionKey } from '../infrastructure/session-id';
import { SessionGuard, type SessionRequest } from './session.guard';

export class RecordingCookieWriter implements SessionCookieWriter {
  cleared = false;

  cookie(): void {}

  clearCookie(): void {
    this.cleared = true;
  }
}

export class MemorySessionRedis implements SessionRedisClient {
  readonly strings = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.strings.delete(key);
    return Promise.resolve();
  }

  sadd(): Promise<void> {
    return Promise.resolve();
  }

  srem(): Promise<void> {
    return Promise.resolve();
  }

  smembers(): Promise<readonly string[]> {
    return Promise.resolve([]);
  }
}

export function createGuard(database: PrismaClient, redis: MemorySessionRedis): SessionGuard {
  const sessions = new RedisSessionStore(redis);
  return new SessionGuard(
    new SessionAccessService(sessions, new PrismaSessionUserStore(database)),
    new SessionCookie(true),
  );
}

export function requestFor(
  rawSessionId: string,
  override?: { body: { tenantId: string }; query: { tenantId: string }; header: string },
): SessionRequest & {
  body?: { tenantId: string };
  query?: { tenantId: string };
  headers: { cookie?: string; 'x-tenant-id'?: string };
} {
  return {
    headers: { cookie: `session=${rawSessionId}`, 'x-tenant-id': override?.header },
    body: override?.body,
    query: override?.query,
  };
}

export function httpContext(
  request: SessionRequest,
  response: SessionCookieWriter,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as ExecutionContext;
}

export async function activate(
  database: PrismaClient,
  redis: MemorySessionRedis,
  rawSessionId: string,
  response: RecordingCookieWriter,
): Promise<unknown> {
  try {
    await createGuard(database, redis).canActivate(httpContext(requestFor(rawSessionId), response));
  } catch (error) {
    return error;
  }
  throw new Error('Expected the guard to reject the session.');
}

export async function createOwner(
  database: PrismaClient,
  subdomain: string,
  redis: MemorySessionRedis,
) {
  const tenant = await database.tenant.create({
    data: { name: subdomain, subdomain, plan: 'STARTER' },
  });
  const user = await database.user.create({
    data: {
      tenantId: tenant.id,
      email: `${subdomain}@example.com`,
      name: 'Ada',
      passwordHash: 'stored-hash',
      status: 'ACTIVE',
      role: 'OWNER',
      authenticationVersion: 1,
    },
  });
  const opened = await new RedisSessionStore(redis).create(
    { userId: user.id, tenantId: tenant.id, role: 'OWNER', authenticationVersion: 1 },
    new Date(),
  );
  return { tenantId: tenant.id, userId: user.id, rawSessionId: opened.rawSessionId };
}

export function rewrite(
  redis: MemorySessionRedis,
  rawSessionId: string,
  fields: Record<string, string>,
): void {
  const key = sessionKey(hashSessionId(rawSessionId));
  const payload = readPayload(redis, key);
  redis.strings.set(key, JSON.stringify({ ...payload, ...fields }));
}

export function readPayload(redis: MemorySessionRedis, key: string): Record<string, string> {
  const payload = redis.strings.get(key);
  if (payload === undefined) {
    throw new Error('Session payload is missing.');
  }
  const parsed: unknown = JSON.parse(payload);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Session payload is missing.');
  }
  return parsed as Record<string, string>;
}

export function past(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

export function invoke(exception: unknown): { statusCode: number; body: unknown } {
  const state: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
  const response = {
    status(statusCode: number) {
      state.statusCode = statusCode;
      return {
        json(body: unknown) {
          state.body = body;
        },
      };
    },
  };
  new IdentityExceptionFilter().catch(exception, {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost);
  return state;
}

export async function clearTenantRows(database: PrismaClient | undefined): Promise<void> {
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
