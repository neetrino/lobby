import { z } from 'zod';

import { Logger } from '@nestjs/common';

import { LocalMemorySessionRedis } from './local-memory-session-redis';
import { SessionStoreUnavailableError } from './session-store-error';
import type { SessionRedisClient } from './session-redis';
import { UnavailableSessionRedis } from './unavailable-session-redis';

const PLACEHOLDER_URL = 'https://...';
const DEFAULT_SESSION_REDIS_TIMEOUT_MS = 3_000;
const MAX_SESSION_REDIS_TIMEOUT_MS = 30_000;

const timeoutSchema = z.coerce.number().int().positive().max(MAX_SESSION_REDIS_TIMEOUT_MS);

const upstashResponseSchema = z.object({
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export type UpstashSessionConfig = {
  url: string;
  token: string;
};

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<Response>;

export class UpstashSessionRedis implements SessionRedisClient {
  constructor(
    private readonly config: UpstashSessionConfig,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs: number = DEFAULT_SESSION_REDIS_TIMEOUT_MS,
  ) {}

  async get(key: string): Promise<string | null> {
    const result = await this.command(['GET', key]);
    return typeof result === 'string' ? result : null;
  }

  async set(key: string, value: string, expiresAtMs: number): Promise<void> {
    await this.command(['SET', key, value, 'PXAT', String(expiresAtMs)]);
  }

  /** `XX` keeps a missing key missing, so a refresh cannot recreate a logged-out session. */
  async replaceIfPresent(key: string, value: string, expiresAtMs: number): Promise<boolean> {
    const result = await this.command(['SET', key, value, 'PXAT', String(expiresAtMs), 'XX']);
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.command(['DEL', key]);
  }

  async sadd(key: string, member: string, expiresAtMs: number): Promise<void> {
    await this.command(['SADD', key, member]);
    const ttl = await this.command(['PTTL', key]);
    if (typeof ttl === 'number' && ttl > expiresAtMs - Date.now()) {
      return;
    }
    await this.command(['PEXPIREAT', key, String(expiresAtMs)]);
  }

  async srem(key: string, member: string): Promise<void> {
    await this.command(['SREM', key, member]);
  }

  async smembers(key: string): Promise<readonly string[]> {
    const result = await this.command(['SMEMBERS', key]);
    if (!Array.isArray(result) || result.some((member) => typeof member !== 'string')) {
      throw new SessionStoreUnavailableError();
    }
    return result.filter((member): member is string => typeof member === 'string');
  }

  private async command(command: readonly string[]): Promise<unknown> {
    const body = await this.post(command);
    const parsed = upstashResponseSchema.safeParse(body);
    if (!parsed.success || parsed.data.error !== undefined) {
      throw new SessionStoreUnavailableError();
    }
    return parsed.data.result ?? null;
  }

  private async post(command: readonly string[]): Promise<unknown> {
    try {
      const response = await this.fetchImpl(this.config.url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        throw new SessionStoreUnavailableError();
      }
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof SessionStoreUnavailableError) {
        throw error;
      }
      throw new SessionStoreUnavailableError();
    }
  }
}

/** Reads the Upstash REST credentials already named in the environment template. */
export function readUpstashSessionConfig(
  env: NodeJS.ProcessEnv = process.env,
): UpstashSessionConfig | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim() ?? '';
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? '';
  if (url.length === 0 || token.length === 0 || url === PLACEHOLDER_URL) {
    return null;
  }
  return { url, token };
}

/**
 * Shared Upstash timeout for session and rate-limit commands.
 * Blank means 3 seconds. An invalid value fails startup instead of hanging a request.
 */
export function readSessionRedisTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SESSION_REDIS_TIMEOUT_MS?.trim() ?? '';
  if (raw.length === 0) {
    return DEFAULT_SESSION_REDIS_TIMEOUT_MS;
  }
  const parsed = timeoutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('SESSION_REDIS_TIMEOUT_MS is invalid.');
  }
  return parsed.data;
}

/** Local process store when Upstash is unset. Production stays closed. */
export function allowsLocalSessionStore(env: NodeJS.ProcessEnv): boolean {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  return (
    env.NODE_ENV === 'development' ||
    env.NODE_ENV === 'test' ||
    env.LOBBY_LOCAL_SESSION === 'memory'
  );
}

export function createSessionRedisClient(env: NodeJS.ProcessEnv = process.env): SessionRedisClient {
  const config = readUpstashSessionConfig(env);
  if (config !== null) {
    return new UpstashSessionRedis(config, fetch, readSessionRedisTimeoutMs(env));
  }
  if (allowsLocalSessionStore(env)) {
    noteLocalStore(env, 'session');
    return new LocalMemorySessionRedis();
  }
  return new UnavailableSessionRedis();
}

function noteLocalStore(env: NodeJS.ProcessEnv, purpose: string): void {
  if (env.NODE_ENV === 'test') {
    return;
  }
  new Logger('SessionStore').warn(`Upstash is unset. Using a process-local ${purpose} store.`);
}
