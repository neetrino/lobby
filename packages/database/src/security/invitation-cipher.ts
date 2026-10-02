import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DUMMY_TOKEN_HASH = createHash('sha256').update('lobby-invitation-dummy').digest('hex');

/** 256-bit invitation secret and the SHA-256 hex stored in the database. */
export function createInvitationSecret(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

/** SHA-256 hex of the raw invitation token. */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Compares a presented token with a stored hash.
 * A missing row still runs the comparison against a fixed hash.
 */
export function invitationTokenMatches(token: string, tokenHash: string | null): boolean {
  const actual = Buffer.from(hashInvitationToken(token), 'utf8');
  const expected = Buffer.from(tokenHash ?? DUMMY_TOKEN_HASH, 'utf8');
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

/** AES-256-GCM seal. The stored value is base64url(iv | tag | ciphertext). */
export function sealInvitationToken(token: string, key: Buffer): string {
  assertInvitationKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

/** Opens a seal produced by {@link sealInvitationToken}. */
export function openInvitationToken(sealed: string, key: Buffer): string {
  assertInvitationKey(key);
  const packed = Buffer.from(sealed, 'base64url');
  if (packed.length <= IV_BYTES + TAG_BYTES) {
    throw new Error('Invitation token seal is invalid.');
  }
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Reads `INVITATION_TOKEN_KEY`.
 * The value is 32 random bytes encoded as base64. An empty value is unconfigured.
 */
export function readInvitationTokenKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.INVITATION_TOKEN_KEY?.trim() ?? '';
  if (raw.length === 0) {
    return null;
  }
  const key = Buffer.from(raw, 'base64');
  assertInvitationKey(key);
  return key;
}

function assertInvitationKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error('INVITATION_TOKEN_KEY must be 32 bytes encoded as base64.');
  }
}
