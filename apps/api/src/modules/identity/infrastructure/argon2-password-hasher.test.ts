import { passwordHashSchema } from '@lobby/contracts';
import { needsRehash } from 'argon2';
import { beforeAll, describe, expect, it } from 'vitest';

import { PASSWORD_MAX_LENGTH } from '../domain/password-policy';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { UNKNOWN_USER_PASSWORD_HASH } from './unknown-user-password-hash';

const password = 'correct-horse-battery';
const hasher = new Argon2PasswordHasher();

let firstHash = '';
let secondHash = '';

beforeAll(async () => {
  [firstHash, secondHash] = await Promise.all([hasher.hash(password), hasher.hash(password)]);
}, 30_000);

describe('Argon2PasswordHasher', () => {
  it('salts each hash so the same password does not repeat', () => {
    expect(firstHash).not.toBe(secondHash);
    expect(passwordHashSchema.safeParse(firstHash).success).toBe(true);
    expect(firstHash).toMatch(/^\$argon2id\$v=19\$m=19456,(?:t=2,p=1|p=1,t=2)\$/);
  });

  it('accepts the original password and rejects a different one', async () => {
    await expect(hasher.verify(firstHash, password)).resolves.toBe(true);
    await expect(hasher.verify(firstHash, 'wrong-horse-battery')).resolves.toBe(false);
  });

  it('returns false for a corrupted hash', async () => {
    await expect(hasher.verify('not-a-hash', password)).resolves.toBe(false);
    await expect(hasher.verify(`${firstHash}broken`, password)).resolves.toBe(false);
    await expect(hasher.verify('', password)).resolves.toBe(false);
  });

  it('verifies the unknown-user digest as a real Argon2id hash and rejects it', async () => {
    expect(passwordHashSchema.safeParse(UNKNOWN_USER_PASSWORD_HASH).success).toBe(true);
    expect(
      needsRehash(UNKNOWN_USER_PASSWORD_HASH, {
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      }),
    ).toBe(false);

    await expect(hasher.verify(UNKNOWN_USER_PASSWORD_HASH, password)).resolves.toBe(false);
  });

  it('does not hash or echo an oversized password', async () => {
    const oversized = 'p'.repeat(PASSWORD_MAX_LENGTH + 1);

    await expect(hasher.hash(oversized)).rejects.toThrow(Error);
    await expect(hasher.hash(oversized)).rejects.toThrow(
      /^Password exceeds the maximum allowed length\.$/,
    );
    await expect(hasher.verify(firstHash, oversized)).resolves.toBe(false);
  });
});
