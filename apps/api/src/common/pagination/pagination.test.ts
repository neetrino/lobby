import { describe, expect, it } from 'vitest';

import { decodeCursor, encodeCursor, filterFingerprint } from './index';

describe('cursor codec', () => {
  it('round-trips JSON and rejects a value that is not cursor JSON', () => {
    const payload = { id: '10000000-0000-4000-8000-000000000001', sort: 'desc' };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
    expect(decodeCursor('not-a-cursor')).toBeUndefined();
  });
});

describe('filterFingerprint', () => {
  it('ignores key order and changes when an allowlisted value changes', () => {
    const left = filterFingerprint({ action: 'user.disabled', outcome: null });
    const right = filterFingerprint({ outcome: null, action: 'user.disabled' });

    expect(left).toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
    expect(filterFingerprint({ action: 'contact.deleted', outcome: null })).not.toBe(left);
  });

  it('rejects a nested value', () => {
    const filters = { action: { equals: 'user.disabled' } } as unknown as Record<string, string>;
    expect(() => filterFingerprint(filters)).toThrow(
      'Filter fingerprint values must be string, finite number, boolean, or null.',
    );
  });
});
