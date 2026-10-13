/**
 * Password hashing boundary. Callers depend on this contract, not on Argon2.
 * Implementations must not log the plaintext password.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/** Nest injection token for {@link PasswordHasher}. */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
