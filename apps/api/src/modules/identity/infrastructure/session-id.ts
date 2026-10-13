import { createHash, randomBytes } from 'node:crypto';

/** CSPRNG length for the cookie value. */
export const SESSION_ID_BYTES = 32;

const BASE64_GROUP_BYTES = 3;
const BASE64_GROUP_CHARS = 4;

/**
 * Unpadded base64url length of `bytes`.
 * 32 bytes encode to 43 characters.
 */
function base64UrlLength(bytes: number): number {
  const remainder = bytes % BASE64_GROUP_BYTES;
  const padding = remainder === 0 ? 0 : BASE64_GROUP_BYTES - remainder;
  return BASE64_GROUP_CHARS * Math.ceil(bytes / BASE64_GROUP_BYTES) - padding;
}

const RAW_SESSION_ID_LENGTH = base64UrlLength(SESSION_ID_BYTES);

const RAW_SESSION_ID_PATTERN = new RegExp(`^[A-Za-z0-9_-]{${RAW_SESSION_ID_LENGTH}}$`);

export const SESSION_KEY_PREFIX = 'session:';
export const USER_SESSIONS_KEY_PREFIX = 'user_sessions:';

export function createRawSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString('base64url');
}

/**
 * Redis key digest of the raw session id.
 * SHA-256 of a 32-byte random id hides the cookie value in Redis.
 * No HMAC pepper is configured.
 */
export function hashSessionId(rawSessionId: string): string {
  return createHash('sha256').update(rawSessionId, 'utf8').digest('hex');
}

export function isRawSessionId(value: string): boolean {
  return RAW_SESSION_ID_PATTERN.test(value);
}

export function sessionKey(sessionIdHash: string): string {
  return `${SESSION_KEY_PREFIX}${sessionIdHash}`;
}

export function userSessionsKey(userId: string): string {
  return `${USER_SESSIONS_KEY_PREFIX}${userId}`;
}
