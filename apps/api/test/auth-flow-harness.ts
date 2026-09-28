import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database/testing';
import type { ZodType } from 'zod';

import { OutboxService } from '../src/common/outbox/outbox.service';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import { OriginGuard } from '../src/common/security/origin.guard';
import { CreateTenantService } from '../src/modules/organizations';
import { AuthRateLimitService } from '../src/modules/identity/application/auth-rate-limit.service';
import { LoginService } from '../src/modules/identity/application/login.service';
import { LogoutService } from '../src/modules/identity/application/logout.service';
import { RegisterService } from '../src/modules/identity/application/register.service';
import { SessionAccessService } from '../src/modules/identity/application/session-access.service';
import { TerminateUserSessionsService } from '../src/modules/identity/application/terminate-user-sessions.service';
import { Argon2PasswordHasher } from '../src/modules/identity/infrastructure/argon2-password-hasher';
import { NestIncidentLogger } from '../src/modules/identity/infrastructure/incident-logger';
import { MemoryRateLimitRedis } from '../src/modules/identity/infrastructure/memory-rate-limit-redis';
import { PrismaLoginAccountStore } from '../src/modules/identity/infrastructure/prisma-login-account';
import { PrismaSessionUserStore } from '../src/modules/identity/infrastructure/prisma-session-user';
import {
  permissiveAuthRateLimits,
  type AuthRateLimitConfig,
} from '../src/modules/identity/infrastructure/rate-limit-config';
import { RedisSessionStore } from '../src/modules/identity/infrastructure/redis-session.store';
import { SessionCookie } from '../src/modules/identity/infrastructure/session-cookie';
import { AuthController } from '../src/modules/identity/presentation/auth.controller';
import { loginSchema } from '../src/modules/identity/presentation/dto/login.schema';
import { registerSchema } from '../src/modules/identity/presentation/dto/register.schema';
import { readAuthenticatedSession, tenantContextFromSession } from '../src/modules/identity/presentation/current-session';
import { IndexedSessionRedis } from '../src/modules/identity/presentation/session-guard.fixtures';
import { SessionGuard, type SessionRequest } from '../src/modules/identity/presentation/session.guard';
import { AUTH_FLOW_ORIGIN, cookieWriter, readJson, sendError, writeJson } from './auth-flow-http';

type AuthServices = {
  auth: AuthController;
  origin: OriginGuard;
  sessions: SessionGuard;
  terminate: TerminateUserSessionsService;
  database: PrismaClient;
};

export type AuthFlowApp = {
  baseUrl: string;
  sessions: IndexedSessionRedis;
  rateLimit: MemoryRateLimitRedis;
  terminate: TerminateUserSessionsService;
  close(): Promise<void>;
};

/** Local Postgres plus the in-memory Redis used by the other identity tests. */
export async function startAuthFlow(
  database: PrismaClient,
  options?: { secure?: boolean; limits?: AuthRateLimitConfig },
): Promise<AuthFlowApp> {
  const sessions = new IndexedSessionRedis();
  const rateLimit = new MemoryRateLimitRedis();
  const services = wire(database, sessions, rateLimit, options?.secure ?? false, options?.limits);
  const server = createServer((request, response) => {
    void route(services, request, response);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Auth flow server did not bind a port.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    sessions,
    rateLimit,
    terminate: services.terminate,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function wire(
  database: PrismaClient,
  sessions: IndexedSessionRedis,
  rateLimit: MemoryRateLimitRedis,
  secure: boolean,
  limits: AuthRateLimitConfig | undefined,
): AuthServices {
  const users = new PrismaSessionUserStore(database);
  const store = new RedisSessionStore(sessions, users);
  const passwords = new Argon2PasswordHasher();
  const incidents = new NestIncidentLogger();
  const cookies = new SessionCookie(secure);
  const rates = new AuthRateLimitService(rateLimit, limits ?? permissiveAuthRateLimits());
  return {
    auth: new AuthController(
      new RegisterService(new CreateTenantService(database, new OutboxService()), passwords, store, true, incidents),
      new LoginService(new PrismaLoginAccountStore(database), passwords, store, incidents),
      new LogoutService(store),
      cookies,
      rates,
    ),
    origin: new OriginGuard([AUTH_FLOW_ORIGIN]),
    sessions: new SessionGuard(new SessionAccessService(store, users), cookies, rates),
    terminate: new TerminateUserSessionsService(users, store),
    database,
  };
}

async function route(services: AuthServices, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  try {
    services.origin.canActivate(httpContext({ method: request.method, headers: request.headers }));
    await dispatch(services, request, response, url);
  } catch (error) {
    sendError(response, error);
  }
}

async function dispatch(
  services: AuthServices,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  if (request.method === 'POST' && url.pathname === '/api/v1/auth/register') {
    await register(services, request, response);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/v1/auth/login') {
    await login(services, request, response);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
    await logout(services, request, response);
    return;
  }
  if (request.method === 'GET' && url.pathname.startsWith('/api/v1/contacts/')) {
    await readContact(services, request, response, url);
    return;
  }
  writeJson(response, 404, { error: { code: 'REQUEST_REJECTED', message: 'The request could not be processed.' } });
}

async function register(services: AuthServices, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = parse(registerSchema, await readJson(request));
  const body = await services.auth.register(input, cookieWriter(response), request);
  writeJson(response, 201, body);
}

async function login(services: AuthServices, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const input = parse(loginSchema, await readJson(request));
  const body = await services.auth.login(input, cookieWriter(response), request);
  writeJson(response, 200, body);
}

async function logout(services: AuthServices, request: IncomingMessage, response: ServerResponse): Promise<void> {
  await services.auth.logout(request, cookieWriter(response));
  response.statusCode = 204;
  response.end();
}

async function readContact(
  services: AuthServices,
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): Promise<void> {
  const sessionRequest = sessionRequestFrom(request);
  await services.sessions.canActivate(httpContext(sessionRequest, cookieWriter(response)));
  const tenant = tenantContextFromSession(readAuthenticatedSession(sessionRequest));
  const contact = await services.database.contact.findFirst({
    where: { id: contactId(url), tenantId: tenant.tenantId },
    select: { id: true, tenantId: true, name: true },
  });
  if (contact === null) {
    throw new NotFoundException();
  }
  writeJson(response, 200, { data: contact });
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const transformed: unknown = new ZodValidationPipe(schema).transform(value);
  return schema.parse(transformed);
}

function contactId(url: URL): string {
  return decodeURIComponent(url.pathname.slice('/api/v1/contacts/'.length));
}

function sessionRequestFrom(request: IncomingMessage): SessionRequest {
  return {
    headers: { cookie: request.headers.cookie },
    ip: request.socket.remoteAddress,
    socket: request.socket,
  };
}

function httpContext(request: object, response?: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as ExecutionContext;
}
