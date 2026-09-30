import 'reflect-metadata';
import { ConsoleLogger, Controller, Get, Logger, Module, Post } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { HealthModule } from '../../modules/health/health.module';
import { IdentityError, identityErrorCodes } from '../../modules/identity/domain/identity.errors';
import { ZodBody } from '../pipes/zod-input';
import { ALLOWED_ORIGINS } from '../security/allowed-origins';
import { OriginGuard } from '../security/origin.guard';
import { ApiExceptionFilter } from './api-exception.filter';
import { configureHttpApp } from './configure-http-app';

const origin = 'http://localhost:3000';
const echoSchema = z.strictObject({ name: z.string().min(1) });

@Controller('probe')
class ProbeController {
  @Post('echo')
  echo(@ZodBody(echoSchema) body: { name: string }): { data: { name: string } } {
    return { data: body };
  }

  @Get('boom')
  boom(): never {
    throw new Error('driver failed secret-token');
  }

  @Get('driver')
  driver(): never {
    throw driverConnectionError();
  }

  @Get('unauthenticated')
  unauthenticated(): never {
    throw new IdentityError(identityErrorCodes.UNAUTHENTICATED);
  }

  @Get('forbidden')
  forbidden(): never {
    throw new IdentityError(identityErrorCodes.FORBIDDEN);
  }
}

@Module({
  imports: [HealthModule],
  controllers: [ProbeController],
  providers: [
    { provide: ALLOWED_ORIGINS, useValue: [origin] },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
class FoundationModule {}

describe('HTTP foundation', () => {
  const logged: string[] = [];
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FoundationModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureHttpApp(app, { allowedOrigins: [origin], trustProxy: false }, { logger: false });
    Logger.overrideLogger({
      log() {},
      error(message: unknown) {
        logged.push(String(message));
      },
      warn() {},
      debug() {},
      verbose() {},
      fatal() {},
    });
    await app.init();
  });

  afterAll(async () => {
    Logger.overrideLogger(new ConsoleLogger());
    await app?.close();
  });

  it('serves health outside the version prefix and ignores a client request id', async () => {
    const http = app.getHttpServer();
    const health = await request(http).get('/health').set('X-Request-Id', 'client-supplied');
    const versioned = await request(http).get('/api/v1/health');

    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    expect(health.headers['x-request-id']).toEqual(expect.any(String));
    expect(health.headers['x-request-id']).not.toBe('client-supplied');
    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(versioned.status).toBe(404);
    expect(versioned.body.error.code).toBe('NOT_FOUND');
  });

  it('allows the configured origin and rejects a foreign one', async () => {
    const http = app.getHttpServer();
    const allowed = await request(http).get('/health').set('Origin', origin);
    const blocked = await request(http).get('/health').set('Origin', 'https://evil.example');
    const mutation = await request(http)
      .post('/api/v1/probe/echo')
      .set('Origin', 'https://evil.example')
      .send({ name: 'Ada' });

    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
    expect(mutation.status).toBe(403);
    expect(mutation.body.error).toMatchObject({
      code: 'ORIGIN_REJECTED',
      requestId: mutation.headers['x-request-id'],
    });
  });

  it('returns a field path for invalid input and hides the submitted value', async () => {
    const http = app.getHttpServer();
    const invalid = await request(http)
      .post('/api/v1/probe/echo')
      .set('Origin', origin)
      .send({ name: '', leak: 'secret-token' });
    const created = await request(http)
      .post('/api/v1/probe/echo')
      .set('Origin', origin)
      .send({ name: 'Ada' });

    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        requestId: invalid.headers['x-request-id'],
        fields: [{ path: 'name' }, { path: 'leak' }],
      },
    });
    expect(JSON.stringify(invalid.body)).not.toContain('secret-token');
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ data: { name: 'Ada' } });
    expect(created.headers['x-request-id']).toEqual(expect.any(String));
    expect(created.body.requestId).toBeUndefined();
  });

  it('logs an unexpected failure with its request id and returns INTERNAL_ERROR', async () => {
    const http = app.getHttpServer();
    const failed = await request(http).get('/api/v1/probe/boom');
    const requestId = failed.headers['x-request-id'];

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId },
    });
    expect(JSON.stringify(failed.body)).not.toContain('secret-token');
    expect(JSON.stringify(failed.body)).not.toContain('driver failed');
    expectSafeUnexpectedLog(logged, String(requestId), 'Error', '/api/v1/probe/boom');
    expect(logged.join('\n')).not.toContain('secret-token');
    expect(logged.join('\n')).not.toContain('driver failed');
  });

  it('maps identity errors without a controller filter', async () => {
    const http = app.getHttpServer();
    const unauthenticated = await request(http).get('/api/v1/probe/unauthenticated');
    const forbidden = await request(http).get('/api/v1/probe/forbidden');

    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('omits driver connection strings from unexpected error logs', async () => {
    const http = app.getHttpServer();
    const failed = await request(http).get('/api/v1/probe/driver?token=secret-token');
    const requestId = failed.headers['x-request-id'];

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId },
    });
    expect(JSON.stringify(failed.body)).not.toContain('secret-token');
    expect(JSON.stringify(failed.body)).not.toContain('postgres://');
    expectSafeUnexpectedLog(
      logged,
      String(requestId),
      'PrismaClientInitializationError',
      '/api/v1/probe/driver',
    );
    const transcript = logged.join('\n');
    expect(transcript).not.toContain('secret-token');
    expect(transcript).not.toContain('postgres://');
    expect(transcript).not.toContain('redis://');
    expect(transcript).not.toContain('db.internal');
    expect(transcript).not.toContain('upstash.io');
  });
});

class PrismaClientInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientInitializationError';
  }
}

function driverConnectionError(): Error {
  const error = new PrismaClientInitializationError(
    "Can't reach database server at postgres://lobby:secret-token@db.internal:5432/lobby",
  );
  error.stack = [
    `${error.name}: ${error.message}`,
    'ReplyError: WRONGPASS redis://default:secret-token@eu1.upstash.io:6379',
    '    at Socket.connect (node:net:1:1)',
  ].join('\n');
  return error;
}

function expectSafeUnexpectedLog(
  entries: readonly string[],
  requestId: string,
  exception: string,
  route: string,
): void {
  const line = entries.find((entry) => entry.includes(requestId) && entry.includes(route));
  expect(line).toEqual(expect.any(String));
  const parsed: unknown = JSON.parse(line ?? '');
  expect(parsed).toEqual({
    requestId,
    exception,
    description: 'Unhandled exception',
    timestamp: expect.any(String),
    method: 'GET',
    route,
  });
  expect(isIsoTimestamp(parsed)).toBe(true);
}

function isIsoTimestamp(value: unknown): boolean {
  if (!isRecord(value) || typeof value.timestamp !== 'string') {
    return false;
  }
  return !Number.isNaN(Date.parse(value.timestamp));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
