import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };
import { type ArgumentsHost, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthRateLimitService } from '../application/auth-rate-limit.service';
import { SessionAccessService } from '../application/session-access.service';
import { IdentityExceptionFilter } from './identity-exception.filter';
import { MemoryRateLimitRedis } from '../infrastructure/memory-rate-limit-redis';
import { permissiveAuthRateLimits } from '../infrastructure/rate-limit-config';
import { PrismaSessionUserStore } from '../infrastructure/prisma-session-user';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import {
  SessionCookie,
  type SessionCookieOptions,
  type SessionCookieWriter,
} from '../infrastructure/session-cookie';
import type { SessionRedisClient } from '../infrastructure/session-redis';
import { hashSessionId, sessionKey } from '../infrastructure/session-id';
import { SessionGuard, type SessionRequest } from './session.guard';

export class RecordingCookieWriter implements SessionCookieWriter {
  cleared = false;
  setCall?: { name: string; value: string; options: SessionCookieOptions };

  cookie(name: string, value: string, options: SessionCookieOptions): void {
    this.setCall = { name, value, options };
  }

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

  replaceIfPresent(key: string, value: string): Promise<boolean> {
    if (!this.strings.has(key)) {
      return Promise.resolve(false);
    }
    this.strings.set(key, value);
    return Promise.resolve(true);
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
    new AuthRateLimitService(new MemoryRateLimitRedis(), permissiveAuthRateLimits()),
    new Reflector(),
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
    ip: '203.0.113.50',
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
    getHandler: () => unmarkedHandler,
    getClass: () => UnmarkedHandler,
  } as unknown as ExecutionContext;
}

class UnmarkedHandler {}

function unmarkedHandler(): void {}

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

export async function createAdmin(database: PrismaClient, redis: MemorySessionRedis) {
  const tenant = await database.tenant.create({
    data: { name: 'Acme', subdomain: 'acme-admin', plan: 'STARTER' },
  });
  const user = await database.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@example.com',
      name: 'Ada',
      passwordHash: 'stored-hash',
      status: 'ACTIVE',
      role: 'ADMIN',
      authenticationVersion: 1,
    },
  });
  const other = await database.user.create({
    data: {
      tenantId: tenant.id,
      email: 'member@example.com',
      name: 'Bea',
      passwordHash: 'stored-hash',
      status: 'ACTIVE',
      role: 'MEMBER',
      authenticationVersion: 1,
    },
  });
  const opened = await new RedisSessionStore(redis).create(
    { userId: user.id, tenantId: tenant.id, role: 'ADMIN', authenticationVersion: 1 },
    new Date(),
  );
  return {
    tenantId: tenant.id,
    userId: user.id,
    otherUserId: other.id,
    rawSessionId: opened.rawSessionId,
  };
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
    switchToHttp: () => ({
      getRequest: () => ({ requestId: 'request-id' }),
      getResponse: () => response,
    }),
  } as ArgumentsHost);
  return state;
}

/** In-memory Redis that records session keys and the user reverse index. */
export class IndexedSessionRedis implements SessionRedisClient {
  readonly strings = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  holdNextSet = false;
  heldKey: string | null = null;
  private releaseHold: (() => void) | undefined;

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  async set(key: string, value: string): Promise<void> {
    if (this.holdNextSet) {
      this.holdNextSet = false;
      this.heldKey = key;
      await new Promise<void>((resolve) => {
        this.releaseHold = resolve;
      });
    }
    this.strings.set(key, value);
  }

  replaceIfPresent(key: string, value: string): Promise<boolean> {
    if (!this.strings.has(key)) {
      return Promise.resolve(false);
    }
    this.strings.set(key, value);
    return Promise.resolve(true);
  }

  release(): void {
    this.releaseHold?.();
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
  await database.tenantModule.deleteMany();
  await database.user.deleteMany();
  await database.tenant.deleteMany();
}
