import { describe, expect, it } from 'vitest';

import { applyTrustProxy, readTrustProxy } from './trust-proxy';

describe('TRUST_PROXY', () => {
  it('stays off unless a hop count or proxy address is configured', () => {
    expect(readTrustProxy({})).toBe(false);
    expect(readTrustProxy({ TRUST_PROXY: 'false' })).toBe(false);
    expect(readTrustProxy({ TRUST_PROXY: 'off' })).toBe(false);
    expect(readTrustProxy({ TRUST_PROXY: '1' })).toBe(1);
    expect(readTrustProxy({ TRUST_PROXY: '10.0.0.1,loopback' })).toBe('10.0.0.1,loopback');
  });

  it('rejects trusting every forwarded header', () => {
    expect(() => readTrustProxy({ TRUST_PROXY: 'true' })).toThrow(
      'TRUST_PROXY cannot trust every X-Forwarded-For value.',
    );
    expect(() => readTrustProxy({ TRUST_PROXY: '*' })).toThrow(
      'TRUST_PROXY cannot trust every X-Forwarded-For value.',
    );
    expect(() => readTrustProxy({ TRUST_PROXY: '9' })).toThrow('TRUST_PROXY is invalid.');
  });

  it('applies the parsed setting on the HTTP app', () => {
    const settings = new Map<string, unknown>();
    applyTrustProxy(
      { set: (setting, value) => settings.set(setting, value) },
      readTrustProxy({ TRUST_PROXY: '2' }),
    );

    expect(settings.get('trust proxy')).toBe(2);
  });
});
