import { Injectable } from '@nestjs/common';

import { RedisSessionStore } from '../infrastructure/redis-session.store';

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

    await this.sessions.revoke(rawSessionId);
  }
}
