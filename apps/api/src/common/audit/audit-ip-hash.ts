import { createHmac } from 'node:crypto';

/** Nest token for the audit IP HMAC key. This is not the session or cookie secret. */
export const AUDIT_IP_HASH_KEY = Symbol('AUDIT_IP_HASH_KEY');

const AUDIT_IP_HASH_KEY_VARIABLE = 'AUDIT_IP_HASH_KEY';
/** Shape only: 64 lowercase hex characters. This does not prove the key is random. */
const AUDIT_IP_HASH_KEY_PATTERN = /^[0-9a-f]{64}$/;
const AUDIT_IP_HASH_KEY_ERROR =
  'AUDIT_IP_HASH_KEY must be 64 lowercase hex characters and must not be one repeated character.';

/**
 * HMAC-SHA256 hex of a client address.
 * The key is the audit secret. A plain SHA-256 of the address is not accepted.
 */
export function hashAuditIp(ip: string, key: string): string {
  assertAuditIpHashKey(key);
  return createHmac('sha256', key).update(ip, 'utf8').digest('hex');
}

/**
 * Reads `AUDIT_IP_HASH_KEY`.
 * Production must set it. Other environments may leave it unset.
 * A present value must be 64 lowercase hex characters and not one repeated character.
 * That check does not prove the value was generated randomly.
 */
export function readAuditIpHashKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env[AUDIT_IP_HASH_KEY_VARIABLE]?.trim() ?? '';
  if (key.length === 0) {
    if (env.NODE_ENV === 'production') {
      throw new Error('AUDIT_IP_HASH_KEY is required in production.');
    }
    return null;
  }
  assertAuditIpHashKey(key);
  return key;
}

function assertAuditIpHashKey(key: string): void {
  if (!AUDIT_IP_HASH_KEY_PATTERN.test(key) || new Set(key).size < 2) {
    throw new Error(AUDIT_IP_HASH_KEY_ERROR);
  }
}
