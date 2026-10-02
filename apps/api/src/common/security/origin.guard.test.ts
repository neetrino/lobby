import { type ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ApiError, apiErrorCodes } from '../http/api-error';
import { readAllowedOrigins } from './allowed-origins';
import { credentialedCorsOptions } from './cors';
import { OriginGuard } from './origin.guard';
import { isOriginAllowed } from './origin-policy';

const allowed = new Set(['http://localhost:3000']);

describe('origin policy', () => {
  it('rejects a mutating request with a missing or foreign origin', () => {
    expect(isOriginAllowed('POST', {}, allowed)).toBe(false);
    expect(isOriginAllowed('DELETE', { origin: 'https://evil.example' }, allowed)).toBe(false);
    expect(
      isOriginAllowed(
        'POST',
        { origin: 'https://evil.example', referer: 'http://localhost:3000/login' },
        allowed,
      ),
    ).toBe(false);
    expect(isOriginAllowed('PUT', { referer: 'https://evil.example/form' }, allowed)).toBe(false);
  });

  it('allows an allowed Origin, a Referer fallback, and safe methods', () => {
    expect(isOriginAllowed('POST', { origin: 'http://localhost:3000' }, allowed)).toBe(true);
    expect(isOriginAllowed('PATCH', { referer: 'http://localhost:3000/settings' }, allowed)).toBe(
      true,
    );
    expect(isOriginAllowed('GET', {}, allowed)).toBe(true);
    expect(isOriginAllowed('OPTIONS', {}, allowed)).toBe(true);
  });

  it('rejects through the guard and keeps credentialed CORS off the wildcard', () => {
    const guard = new OriginGuard(['http://localhost:3000']);
    expect(guard.canActivate(context('POST', { origin: 'http://localhost:3000' }))).toBe(true);
    expect(() => guard.canActivate(context('POST', {}))).toThrow(ApiError);
    try {
      guard.canActivate(context('POST', { origin: 'https://evil.example' }));
    } catch (error) {
      expect(error).toMatchObject({ code: apiErrorCodes.ORIGIN_REJECTED, statusCode: 403 });
    }

    const cors = credentialedCorsOptions(['http://localhost:3000']);
    expect(cors.credentials).toBe(true);
    expect(cors.origin).toEqual(['http://localhost:3000']);
    expect(cors.allowedHeaders).toContain('X-Request-Id');
    expect(cors.exposedHeaders).toEqual(['X-Request-Id']);
    expect(JSON.stringify(cors)).not.toContain('*');
    expect(credentialedCorsOptions([]).origin).toBe(false);
  });

  it('reads an explicit allowlist and rejects a wildcard', () => {
    expect(readAllowedOrigins({ ALLOWED_ORIGINS: 'http://localhost:3000/' })).toEqual([
      'http://localhost:3000',
    ]);
    expect(readAllowedOrigins({ APP_URL: 'http://localhost:3000' })).toEqual([
      'http://localhost:3000',
    ]);
    expect(() => readAllowedOrigins({ ALLOWED_ORIGINS: '*' })).toThrow(/invalid origin/i);
  });
});

function context(method: string, headers: { origin?: string; referer?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as ExecutionContext;
}
