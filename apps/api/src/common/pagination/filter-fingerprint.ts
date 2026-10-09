import { createHash } from 'node:crypto';

import { z } from 'zod';

/** A filter value the module already allowlisted. This is not a database query. */
export type FilterFingerprintValue = string | number | boolean | null;

/** SHA-256 hex produced by `filterFingerprint`. */
export const filterFingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * Stable digest of one endpoint's allowlisted filters.
 * Key order does not matter. The caller must pass the same keys on every page, using null for an absent filter.
 * `limit` stays out of this digest so the client can change page size.
 */
export function filterFingerprint(
  filters: Readonly<Record<string, FilterFingerprintValue>>,
): string {
  const entries = Object.keys(filters)
    .sort()
    .map((key) => [key, readFingerprintValue(filters[key])]);
  return createHash('sha256').update(JSON.stringify(entries), 'utf8').digest('hex');
}

function readFingerprintValue(value: FilterFingerprintValue | undefined): FilterFingerprintValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  throw new Error('Filter fingerprint values must be string, finite number, boolean, or null.');
}
