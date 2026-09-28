import { z } from 'zod';

import type { SessionRedisClient } from './session-redis';
import { UnavailableSessionRedis } from './unavailable-session-redis';

const PLACEHOLDER_URL = 'https://...';
const SESSION_STORE_UNAVAILABLE = 'Session store is unavailable.';

const upstashResponseSchema = z.object({
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export type UpstashSessionConfig = {
  url: string;
  token: string;
};

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

export class UpstashSessionRedis implements SessionRedisClient {
  constructor(
    private readonly config: UpstashSessionConfig,
    private readonly fetchImpl: FetchLike = fetch,
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
      throw new Error(SESSION_STORE_UNAVAILABLE);
    }
    return result.filter((member): member is string => typeof member === 'string');
  }

  private async command(command: readonly string[]): Promise<unknown> {
    const body = await this.post(command);
    const parsed = upstashResponseSchema.safeParse(body);
    if (!parsed.success || parsed.data.error !== undefined) {
      throw new Error(SESSION_STORE_UNAVAILABLE);
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
      });
      if (!response.ok) {
        throw new Error(SESSION_STORE_UNAVAILABLE);
      }
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof Error && error.message === SESSION_STORE_UNAVAILABLE) {
        throw error;
      }
      throw new Error(SESSION_STORE_UNAVAILABLE);
    }
  }
}

/** Reads the Upstash REST credentials already named in the environment template. */
export function readUpstashSessionConfig(env: NodeJS.ProcessEnv = process.env): UpstashSessionConfig | null {
  const url = env.UPSTASH_REDIS_REST_URL?.trim() ?? '';
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? '';
  if (url.length === 0 || token.length === 0 || url === PLACEHOLDER_URL) {
    return null;
  }
  return { url, token };
}

export function createSessionRedisClient(env: NodeJS.ProcessEnv = process.env): SessionRedisClient {
  const config = readUpstashSessionConfig(env);
  return config === null ? new UnavailableSessionRedis() : new UpstashSessionRedis(config);
}
