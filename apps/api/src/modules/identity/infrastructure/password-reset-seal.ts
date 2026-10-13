import { createCipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Seal layout matches `packages/database/src/security/invitation-cipher.ts`.
 * The worker opens this seal with `openInvitationToken`. The same
 * `INVITATION_TOKEN_KEY` seals invitation and password-reset delivery.
 */
const TOKEN_BYTES = 32;
const KEY_BYTES = 32;
const IV_BYTES = 12;

/** 256-bit reset secret and the SHA-256 hex stored in the database. */
export function createPasswordResetSecret(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashPasswordResetToken(token) };
}

/** SHA-256 hex of the raw reset token. */
export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** AES-256-GCM seal. The stored value is base64url(iv | tag | ciphertext). */
export function sealPasswordResetToken(token: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

/**
 * Reads `INVITATION_TOKEN_KEY`.
 * The value is 32 random bytes encoded as base64. An empty value is unconfigured.
 */
export function readPasswordResetTokenKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.INVITATION_TOKEN_KEY?.trim() ?? '';
  if (raw.length === 0) {
    return null;
  }
  const key = Buffer.from(raw, 'base64');
  assertKey(key);
  return key;
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error('INVITATION_TOKEN_KEY must be 32 bytes encoded as base64.');
  }
}

/** Injection token for the password-reset seal key. */
export const PASSWORD_RESET_TOKEN_KEY = Symbol('PASSWORD_RESET_TOKEN_KEY');
