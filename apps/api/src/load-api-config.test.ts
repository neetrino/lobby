import { describe, expect, it } from 'vitest';

import { ApiConfigError, loadApiConfig } from './load-api-config';

const databaseUrl = 'postgresql://localhost/lobby';

describe('loadApiConfig', () => {
  it('applies defaults after the existing validators accept the environment', async () => {
    const config = await loadApiConfig({
      DATABASE_URL: databaseUrl,
      APP_URL: 'http://localhost:3000',
    });

    expect(config.port).toBe(3001);
    expect(config.databaseUrl).toBe(databaseUrl);
    expect(config.trustProxy).toBe(false);
    expect(config.allowedOrigins).toEqual(['http://localhost:3000']);
  });

  it('reads an explicit port and proxy hop count', async () => {
    const config = await loadApiConfig({
      DATABASE_URL: databaseUrl,
      APP_URL: 'http://localhost:3000',
      PORT: '4000',
      TRUST_PROXY: '2',
    });

    expect(config.port).toBe(4000);
    expect(config.trustProxy).toBe(2);
  });

  it('lists every invalid variable and leaves values and parser dumps out of the message', async () => {
    const secret = 'postgres://user:super-secret-password@db/lobby';
    const error = await configError({
      PORT: 'nope',
      DATABASE_URL: '   ',
      ALLOWED_ORIGINS: '*',
      TRUST_PROXY: secret,
      SESSION_REDIS_TIMEOUT_MS: 'nope',
      RATE_LIMIT_LOGIN_IP_LIMIT: '0',
      RATE_LIMIT_REGISTER_IP_WINDOW_MS: 'abc',
    });

    expect(error.message).toContain('Invalid environment configuration:');
    expect(error.message).toContain('- PORT: PORT must be an integer from 1 to 65535.');
    expect(error.message).toContain('- DATABASE_URL:');
    expect(error.message).toContain('- ALLOWED_ORIGINS:');
    expect(error.message).toContain('- TRUST_PROXY:');
    expect(error.message).toContain('- SESSION_REDIS_TIMEOUT_MS:');
    expect(error.message).toContain('- RATE_LIMIT_LOGIN_IP_LIMIT:');
    expect(error.message).toContain('- RATE_LIMIT_REGISTER_IP_WINDOW_MS:');
    expect(error.issues.map((issue) => issue.variable)).toEqual([
      'PORT',
      'DATABASE_URL',
      'ALLOWED_ORIGINS',
      'TRUST_PROXY',
      'SESSION_REDIS_TIMEOUT_MS',
      'RATE_LIMIT_LOGIN_IP_LIMIT',
      'RATE_LIMIT_REGISTER_IP_WINDOW_MS',
    ]);
    expect(error.message).not.toContain(secret);
    expect(error.message).not.toContain('nope');
    expect(error.message).not.toContain('Zod');
  });
});

async function configError(env: NodeJS.ProcessEnv): Promise<ApiConfigError> {
  try {
    await loadApiConfig(env);
  } catch (error) {
    if (error instanceof ApiConfigError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected environment validation to fail.');
}
