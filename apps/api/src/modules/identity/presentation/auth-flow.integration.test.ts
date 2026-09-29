import { createTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readSessionCookieSecure } from '../infrastructure/session-cookie';
import { clearTenantRows } from './session-guard.fixtures';
import { startAuthFlow, type AuthFlowApp } from '../../../../test/auth-flow-harness';
import {
  capturedLogs,
  idleCookieMaxAge,
  installLogCapture,
  send,
} from '../../../../test/auth-flow-http';

const password = 'correct-horse-battery';
const email = 'ada@example.com';

let prisma: PrismaClient;
let app: AuthFlowApp;
let restoreLogs: () => void;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
  restoreLogs = installLogCapture();
  app = await startAuthFlow(prisma, { secure: readSessionCookieSecure() });
}, 60_000);

afterAll(async () => {
  await app?.close();
  restoreLogs?.();
  await clearTenantRows(prisma);
  await prisma?.$disconnect();
});

beforeEach(async () => {
  capturedLogs.length = 0;
  app.sessions.strings.clear();
  app.sessions.sets.clear();
  app.rateLimit.counters.clear();
  await clearTenantRows(prisma);
});

describe('auth http flow', () => {
  it('registers, reads a tenant contact, then rejects the same cookie after logout', async () => {
    const registered = await send(app.baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: registration('acme'),
    });
    const rawSessionId = sessionId(registered.setCookie);
    const account = accountOf(registered.body);
    const contact = await prisma.contact.create({
      data: { tenantId: account.tenant.id, name: 'Ada ledger' },
    });

    const allowed = await send(
      app.baseUrl,
      `/api/v1/contacts/${contact.id}?tenantId=other-tenant`,
      {
        method: 'GET',
        cookie: rawSessionId,
        headers: { 'x-tenant-id': 'other-tenant' },
      },
    );
    const loggedOut = await send(app.baseUrl, '/api/v1/auth/logout', {
      method: 'POST',
      cookie: rawSessionId,
    });
    const rejected = await send(app.baseUrl, `/api/v1/contacts/${contact.id}`, {
      method: 'GET',
      cookie: rawSessionId,
    });

    expect(registered.status).toBe(201);
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({
      data: { id: contact.id, tenantId: account.tenant.id, name: 'Ada ledger' },
    });
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.setCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    expect(rejected.status).toBe(401);
    expect(rejected.body).toMatchObject({ error: { code: 'SESSION_REVOKED' } });
    expectCookie(registered.setCookie, readSessionCookieSecure());
    expectNoSecrets(registered.body, rawSessionId);
    expectNoSecrets(rejected.body, rawSessionId);
  }, 30_000);

  it('rejects the old cookie after every session is terminated', async () => {
    await send(app.baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: registration('acme'),
    });
    const signedIn = await send(app.baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: credentials('acme'),
    });
    const rawSessionId = sessionId(signedIn.setCookie);
    const account = accountOf(signedIn.body);
    const contact = await prisma.contact.create({
      data: { tenantId: account.tenant.id, name: 'Ada ledger' },
    });

    await app.terminate.terminateAllSessions(
      { userId: account.user.id, tenantId: account.tenant.id, role: 'OWNER' },
      account.user.id,
    );
    const rejected = await send(app.baseUrl, `/api/v1/contacts/${contact.id}`, {
      method: 'GET',
      cookie: rawSessionId,
    });

    expect(rejected.status).toBe(401);
    expect(rejected.body).toMatchObject({ error: { code: 'SESSION_REVOKED' } });
    expect(redisDump(app)).not.toContain(rawSessionId);
  }, 30_000);

  it('resolves the same email inside the requested tenant and hides the other tenant contact', async () => {
    await send(app.baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: registration('acme'),
    });
    await send(app.baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: registration('beta'),
    });
    const acme = await send(app.baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: credentials('acme'),
    });
    const beta = await send(app.baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: credentials('beta'),
    });
    const acmeAccount = accountOf(acme.body);
    const betaAccount = accountOf(beta.body);
    const foreign = await prisma.contact.create({
      data: { tenantId: betaAccount.tenant.id, name: 'Beta ledger' },
    });
    const wrongTenant = await send(app.baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: credentials('missing'),
    });
    const hidden = await send(
      app.baseUrl,
      `/api/v1/contacts/${foreign.id}?tenantId=${betaAccount.tenant.id}`,
      {
        method: 'GET',
        cookie: sessionId(acme.setCookie),
        headers: { 'x-tenant-id': betaAccount.tenant.id },
      },
    );

    expect(acmeAccount.user.email).toBe(email);
    expect(betaAccount.user.email).toBe(email);
    expect(acmeAccount.tenant.id).not.toBe(betaAccount.tenant.id);
    expect(acmeAccount.user.id).not.toBe(betaAccount.user.id);
    expect(wrongTenant.status).toBe(401);
    expect(wrongTenant.body).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toContain('Beta ledger');
    expect(JSON.stringify(hidden.body)).not.toContain(betaAccount.tenant.id);
  }, 30_000);
});

describe('auth http security', () => {
  it('sets Secure only when the session cookie config asks for it', async () => {
    const secure = await startAuthFlow(prisma, {
      secure: readSessionCookieSecure({ NODE_ENV: 'production' }),
    });
    try {
      const registered = await send(secure.baseUrl, '/api/v1/auth/register', {
        method: 'POST',
        body: registration('secure-shop'),
      });
      expect(readSessionCookieSecure({ NODE_ENV: 'production' })).toBe(true);
      expectCookie(registered.setCookie, true);
      expect(registered.setCookie).toContain(`Max-Age=${idleCookieMaxAge()}`);
    } finally {
      await secure.close();
    }
  }, 30_000);

  it('rejects a missing or foreign Origin and a validation error without echoing the password', async () => {
    const missing = await send(app.baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      origin: null,
      body: credentials('acme'),
    });
    const foreign = await send(app.baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      origin: 'https://evil.example',
      body: credentials('acme'),
    });
    const invalid = await send(app.baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: registration('acme', 'short'),
    });

    expect(missing.status).toBe(403);
    expect(missing.body).toMatchObject({ error: { code: 'ORIGIN_REJECTED' } });
    expect(foreign.status).toBe(403);
    expect(foreign.setCookie).toBeUndefined();
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        requestId: invalid.requestId,
        fields: [{ path: 'owner.password' }],
      },
    });
    expect(JSON.stringify(invalid.body)).not.toContain('short');
  });

  it('returns 429 once the login IP limit is exceeded and stores only hashed keys', async () => {
    const limited = await startAuthFlow(prisma, {
      limits: {
        loginIp: { limit: 2, windowMs: 60_000 },
        loginAccount: { limit: 10, windowMs: 60_000 },
        registerIp: { limit: 10, windowMs: 60_000 },
        invalidSessionIp: { limit: 10, windowMs: 60_000 },
      },
    });
    try {
      await send(limited.baseUrl, '/api/v1/auth/register', {
        method: 'POST',
        body: registration('acme'),
      });
      await send(limited.baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        body: credentials('acme', 'wrong-password-1'),
      });
      await send(limited.baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        body: credentials('acme', 'wrong-password-1'),
      });
      const blocked = await send(limited.baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        body: credentials('acme', 'wrong-password-1'),
      });
      const keys = [...limited.rateLimit.counters.keys()];

      expect(blocked.status).toBe(429);
      expect(blocked.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.every((key) => key.startsWith('rate_limit:'))).toBe(true);
      expect(keys.join(' ')).not.toContain(email);
      expect(keys.join(' ')).not.toContain('wrong-password-1');
      expect(keys.join(' ')).not.toContain('127.0.0.1');
      expect(keys.join(' ')).not.toContain('::1');
    } finally {
      await limited.close();
    }
  }, 30_000);

  it('keeps the password and raw session id out of logs, Redis, and responses', async () => {
    const registered = await send(app.baseUrl, '/api/v1/auth/register', {
      method: 'POST',
      body: registration('acme'),
    });
    const rawSessionId = sessionId(registered.setCookie);
    const stored = await prisma.user.findFirstOrThrow({ where: { email } });
    await send(app.baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: credentials('acme', 'wrong-password-value'),
    });
    const transcript = [
      JSON.stringify(registered.body),
      capturedLogs.join('\n'),
      redisDump(app),
    ].join('\n');

    expect(transcript).not.toContain(password);
    expect(transcript).not.toContain(rawSessionId);
    expect(transcript).not.toContain(stored.passwordHash);
    expect(transcript).not.toContain('Prisma');
    expect(transcript).not.toContain('Argon');
  }, 30_000);
});

function registration(subdomain: string, secret = password) {
  return {
    tenant: { name: subdomain, subdomain, plan: 'starter' as const },
    owner: { name: 'Ada', email, password: secret },
  };
}

function credentials(subdomain: string, secret = password) {
  return { subdomain, email, password: secret };
}

function sessionId(setCookie: string | undefined): string {
  const match = setCookie?.match(/^session=([^;]+)/);
  if (match?.[1] === undefined || match[1].length === 0) {
    throw new Error('Session cookie was not set.');
  }
  return decodeURIComponent(match[1]);
}

function accountOf(body: unknown): {
  tenant: { id: string };
  user: { id: string; email: string };
} {
  if (!isAccount(body)) {
    throw new Error('Auth response did not include the account.');
  }
  return body.data;
}

function isAccount(
  body: unknown,
): body is { data: { tenant: { id: string }; user: { id: string; email: string } } } {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    return false;
  }
  const data = body.data;
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  return 'tenant' in data && 'user' in data;
}

function expectCookie(setCookie: string | undefined, secure: boolean): void {
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('SameSite=Lax');
  expect(setCookie).toContain('Path=/');
  expect(setCookie?.includes('Secure')).toBe(secure);
}

function expectNoSecrets(body: unknown, rawSessionId: string): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(password);
  expect(serialized).not.toContain(rawSessionId);
  expect(serialized).not.toContain('passwordHash');
}

function redisDump(flow: AuthFlowApp): string {
  return JSON.stringify({
    strings: [...flow.sessions.strings.entries()],
    sets: [...flow.sessions.sets.entries()].map(([key, members]) => [key, [...members]]),
  });
}
