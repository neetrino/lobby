import { Injectable } from '@nestjs/common';
import { argon2id, hash as hashPassword, verify as verifyPassword } from 'argon2';

import type { PasswordHasher } from '../domain/password-hasher';
import { PASSWORD_MAX_LENGTH } from '../domain/password-policy';

/** OWASP Password Storage Cheat Sheet: Argon2id, 19 MiB, 2 iterations, 1 lane. */
const ARGON2_MEMORY_COST_KIB = 19_456;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH_BYTES = 32;

const PASSWORD_TOO_LONG = 'Password exceeds the maximum allowed length.';

const argon2idOptions = {
  type: argon2id,
  memoryCost: ARGON2_MEMORY_COST_KIB,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
  hashLength: ARGON2_HASH_LENGTH_BYTES,
} as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new Error(PASSWORD_TOO_LONG);
    }

    return hashPassword(password, argon2idOptions);
  }

  async verify(storedHash: string, password: string): Promise<boolean> {
    if (password.length > PASSWORD_MAX_LENGTH) {
      return false;
    }

    try {
      return await verifyPassword(storedHash, password);
    } catch {
      return false;
    }
  }
}
