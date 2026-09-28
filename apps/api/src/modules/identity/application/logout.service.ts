import { Injectable } from '@nestjs/common';

import { IdentityError, identityErrorCodes } from '../domain/identity.errors';
import { RedisSessionStore } from '../infrastructure/redis-session.store';
import { SessionStoreUnavailableError } from '../infrastructure/session-store-error';

@Injectable()
export class LogoutService {
  constructor(private readonly sessions: RedisSessionStore) {}

  /**
   * Deletes the presented session when one exists.
   * A missing, expired, or malformed cookie is still a successful logout.
   */
  async logout(rawSessionId: string | null): Promise<void> {
    if (rawSessionId === null) {
      return;
    }

    try {
      await this.sessions.revoke(rawSessionId);
    } catch (error) {
      if (error instanceof SessionStoreUnavailableError) {
        throw new IdentityError(identityErrorCodes.SERVICE_UNAVAILABLE);
      }
      throw error;
    }
  }
}
