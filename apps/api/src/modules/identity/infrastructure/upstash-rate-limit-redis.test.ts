import { describe, expect, it } from 'vitest';

import { UpstashRateLimitRedis } from './upstash-rate-limit-redis';

describe('UpstashRateLimitRedis', () => {
  it('aborts a slow command with the shared timeout and hides the reason', async () => {
    const client = new UpstashRateLimitRedis(
      { url: 'https://example.upstash.io', token: 'secret-token' },
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(init.signal.reason ?? new Error('secret-token timed out'));
          });
        }),
      20,
    );

    await expect(client.increment('rate_limit:login:ip:abc', 60_000)).rejects.toThrow(
      /^Rate limit store is unavailable\.$/,
    );
  });
});
