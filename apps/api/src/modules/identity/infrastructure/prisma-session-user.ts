import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/outbox';

export type SessionUserSecurity = {
  status: 'ACTIVE' | 'DISABLED';
  authenticationVersion: number;
};

@Injectable()
export class PrismaSessionUserStore {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /** Loads the live user row for the session's own tenant. Redis is not enough. */
  async findSecurity(userId: string, tenantId: string): Promise<SessionUserSecurity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id_tenantId: { id: userId, tenantId } },
      select: { status: true, authenticationVersion: true },
    });
    if (user === null) {
      return null;
    }

    return { status: user.status, authenticationVersion: user.authenticationVersion };
  }
}
