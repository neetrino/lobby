import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { hashAuditIp, readAuditIpHashKey } from './audit-ip-hash';

const key = '0123456789abcdef'.repeat(4);
const otherKey = 'fedcba9876543210'.repeat(4);

describe('hashAuditIp', () => {
  it('uses a keyed HMAC and not the unsalted address digest', () => {
    const ip = '203.0.113.10';
    const hashed = hashAuditIp(ip, key);

    expect(hashed).toHaveLength(64);
    expect(hashed).not.toBe(createHash('sha256').update(ip, 'utf8').digest('hex'));
    expect(hashed).not.toBe(hashAuditIp(ip, otherKey));
    expect(hashed).not.toContain(ip);
  });

  it('rejects a short key and a repeated character without echoing either', () => {
    for (const secret of ['too-short', 'a'.repeat(32), 'a'.repeat(64)]) {
      expect(() => hashAuditIp('127.0.0.1', secret)).toThrow(
        'AUDIT_IP_HASH_KEY must be 64 lowercase hex characters and must not be one repeated character.',
      );
    }
  });
});

describe('readAuditIpHashKey', () => {
  it('requires the key in production and allows it to be absent otherwise', () => {
    expect(readAuditIpHashKey({ NODE_ENV: 'development' })).toBeNull();
    expect(readAuditIpHashKey({ NODE_ENV: 'test', AUDIT_IP_HASH_KEY: key })).toBe(key);
    expect(() => readAuditIpHashKey({ NODE_ENV: 'production' })).toThrow(
      'AUDIT_IP_HASH_KEY is required in production.',
    );
    expect(() =>
      readAuditIpHashKey({ NODE_ENV: 'production', AUDIT_IP_HASH_KEY: 'a'.repeat(64) }),
    ).toThrow(
      'AUDIT_IP_HASH_KEY must be 64 lowercase hex characters and must not be one repeated character.',
    );
  });
});
