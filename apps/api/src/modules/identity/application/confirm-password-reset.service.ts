import { Inject, Injectable } from '@nestjs/common';

import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { PASSWORD_HASHER, type PasswordHasher } from '../domain/password-hasher';
import { PrismaPasswordResetStore } from '../infrastructure/prisma-password-reset';
import { hashPasswordResetToken } from '../infrastructure/password-reset-seal';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionStoreUnavailableError } from '../infrastructure/session-store-error';
import type { AuditClient } from './terminate-user-sessions.service';

export type ConfirmPasswordResetInput = {
  token: string;
  password: string;
  requestId: string;
  client: AuditClient;
};

@Injectable()
export class ConfirmPasswordResetService {
  constructor(
    private readonly resets: PrismaPasswordResetStore,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    private readonly sessions: RedisSessionStore,
  ) {}

  /**
   * Replaces the password and retires existing sessions.
   * A missing, used, or expired token is the same error.
   */
  async confirm(input: ConfirmPasswordResetInput): Promise<void> {
    const passwordHash = await this.passwords.hash(input.password);
    const replaced = await this.resets.consume({
      tokenHash: hashPasswordResetToken(input.token),
      passwordHash,
      now: new Date(),
      requestId: input.requestId,
      client: input.client,
    });
    if (replaced === null) {
      throw new IdentityError(identityErrorCodes.PASSWORD_RESET_INVALID);
    }
    await this.retireSessions(replaced.userId);
  }

  /** The version bump already rejects old sessions when Redis cannot be reached. */
  private async retireSessions(userId: string): Promise<void> {
    try {
      await this.sessions.deleteAllForUser(userId);
    } catch (error) {
      if (!(error instanceof SessionStoreUnavailableError)) {
        throw error;
      }
    }
  }
}
