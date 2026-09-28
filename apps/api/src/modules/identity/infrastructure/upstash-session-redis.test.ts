import { describe, expect, it } from 'vitest';

import { createSessionRedisClient, UpstashSessionRedis } from './upstash-session-redis';

describe('UpstashSessionRedis', () => {
  it('stores a session with an absolute expiry and hides transport failures', async () => {
    const calls: unknown[] = [];
    const client = new UpstashSessionRedis({ url: 'https://example.upstash.io', token: 'secret-token' }, async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
    });

    await client.set('session:abc', 'payload', 1_700_000_000_000);

    expect(calls).toEqual([['SET', 'session:abc', 'payload', 'PXAT', '1700000000000']]);
  });

  it('refreshes with SET XX and reports a missing key as not replaced', async () => {
    const calls: unknown[] = [];
    const client = new UpstashSessionRedis({ url: 'https://example.upstash.io', token: 'secret-token' }, async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ result: null }), { status: 200 });
    });

    await expect(client.replaceIfPresent('session:abc', 'payload', 1_700_000_000_000)).resolves.toBe(false);
    expect(calls).toEqual([['SET', 'session:abc', 'payload', 'PXAT', '1700000000000', 'XX']]);
  });

  it('does not include the token when the command fails', async () => {
    const client = new UpstashSessionRedis({ url: 'https://example.upstash.io', token: 'secret-token' }, async () => {
      return new Response(JSON.stringify({ error: 'WRONGPASS secret-token' }), { status: 401 });
    });

    await expect(client.get('session:abc')).rejects.toThrow('Session store is unavailable.');
    await expect(client.get('session:abc')).rejects.toThrow(/^Session store is unavailable\.$/);
  });

  it('stays closed when Upstash credentials are missing', () => {
    const client = createSessionRedisClient({ UPSTASH_REDIS_REST_URL: 'https://...', UPSTASH_REDIS_REST_TOKEN: '' });

    return expect(client.get('session:abc')).rejects.toThrow('Session store is unavailable.');
  });
});
